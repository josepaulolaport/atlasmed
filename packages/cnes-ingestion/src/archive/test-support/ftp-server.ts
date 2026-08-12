import { createServer, type Server, type Socket } from "node:net";

/**
 * A minimal FTP server, for testing the archive reader without touching
 * DATASUS.
 *
 * It exists because the questions worth answering here — does the client
 * survive a transfer we abandon half-way, how many times does it log in — are
 * questions about a real socket conversation, and the only other way to ask
 * them was to keep hammering a public origin that rate-limits per IP. That is
 * how we got blocked.
 *
 * Supports exactly what the reader uses: passive mode, `REST` offsets, `RETR`,
 * `SIZE`, `LIST`. Everything else gets a polite 200.
 */
export interface FtpServerHandle {
  port: number;
  /** Control connections accepted — i.e. logins. */
  logins: number;
  /** RETR commands served. */
  transfers: number;
  /** Transfers the client walked away from before the end of the file. */
  abandonedTransfers: number;
  close(): Promise<void>;
}

export async function startFtpServer(input: {
  files: Record<string, Uint8Array>;
}): Promise<FtpServerHandle> {
  const handle: Partial<FtpServerHandle> = {
    logins: 0,
    transfers: 0,
    abandonedTransfers: 0,
  };

  const openSockets = new Set<Socket>();
  const openDataServers = new Set<Server>();

  const server: Server = createServer((control: Socket) => {
    handle.logins = (handle.logins ?? 0) + 1;
    openSockets.add(control);
    control.on("close", () => openSockets.delete(control));

    let restOffset = 0;
    let pendingData: { server: Server; socket: Promise<Socket> } | null = null;

    const reply = (line: string) => control.write(`${line}\r\n`);

    const openPassive = async (): Promise<number> => {
      let resolveSocket: (socket: Socket) => void = () => {};
      const socket = new Promise<Socket>((resolve) => {
        resolveSocket = resolve;
      });
      const dataServer = createServer((s) => {
        openSockets.add(s);
        s.on("close", () => openSockets.delete(s));
        resolveSocket(s);
      });
      openDataServers.add(dataServer);
      dataServer.on("close", () => openDataServers.delete(dataServer));
      await new Promise<void>((resolve) =>
        dataServer.listen(0, "127.0.0.1", resolve)
      );
      pendingData = { server: dataServer, socket };
      const address = dataServer.address();
      if (typeof address === "string" || address === null) {
        throw new Error("passive listener has no port");
      }
      return address.port;
    };

    const send = async (payload: Uint8Array) => {
      const data = pendingData;
      if (!data) {
        reply("425 Use PASV first");
        return;
      }
      pendingData = null;
      reply("150 Opening data connection");
      const socket = await data.socket;

      handle.transfers = (handle.transfers ?? 0) + 1;
      let delivered = 0;
      const finished = new Promise<void>((resolve) => {
        // The client abandoning the transfer shows up here, as the data socket
        // closing before every byte is written.
        socket.on("close", () => resolve());
        socket.on("error", () => resolve());
      });

      const CHUNK = 8 * 1024;
      for (let at = 0; at < payload.length; at += CHUNK) {
        if (socket.destroyed || socket.writableEnded) break;
        const slice = payload.subarray(at, at + CHUNK);
        const flushed = socket.write(slice);
        delivered += slice.length;
        if (!flushed) {
          await new Promise<void>((resolve) => socket.once("drain", () => resolve()));
        }
        // Yield so a client that walked away has a chance to close the socket
        // before the next write. Without this the loop runs to completion on
        // loopback and the transfer never looks abandoned.
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      if (delivered < payload.length) {
        handle.abandonedTransfers = (handle.abandonedTransfers ?? 0) + 1;
      }
      socket.end();
      await finished;
      data.server.close();
      // The reply the control connection must consume before it is usable
      // again. Whether the client does that is exactly what we are testing.
      reply("226 Transfer complete");
    };

    control.write("220 test server ready\r\n");

    let buffer = "";
    control.on("data", async (chunk) => {
      buffer += chunk.toString("latin1");
      let newline = buffer.indexOf("\r\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        newline = buffer.indexOf("\r\n");

        const [rawCommand, ...rest] = line.split(" ");
        const command = (rawCommand ?? "").toUpperCase();
        const argument = rest.join(" ");

        switch (command) {
          case "USER":
            reply("331 Need password");
            break;
          case "PASS":
            reply("230 Logged in");
            break;
          case "FEAT":
            control.write("211-Features\r\n REST STREAM\r\n SIZE\r\n211 End\r\n");
            break;
          case "PWD":
            reply('257 "/" is the current directory');
            break;
          case "CWD":
            reply("250 Directory changed");
            break;
          case "TYPE":
            reply("200 Type set");
            break;
          case "REST":
            restOffset = Number(argument) || 0;
            reply("350 Restarting at offset");
            break;
          case "SIZE": {
            const file = input.files[argument.replace(/^\//, "")];
            reply(file ? `213 ${file.length}` : "550 No such file");
            break;
          }
          case "PASV": {
            const port = await openPassive();
            const high = Math.floor(port / 256);
            const low = port % 256;
            reply(`227 Entering Passive Mode (127,0,0,1,${high},${low})`);
            break;
          }
          case "LIST": {
            const names = Object.keys(input.files);
            const listing = names
              .map((name) => `-rw-r--r-- 1 o g ${input.files[name]!.length} Jan 1 00:00 ${name}`)
              .join("\r\n");
            await send(new TextEncoder().encode(`${listing}\r\n`));
            break;
          }
          case "RETR": {
            const file = input.files[argument.replace(/^\//, "")];
            if (!file) {
              reply("550 No such file");
              break;
            }
            const from = restOffset;
            restOffset = 0;
            await send(file.subarray(from));
            break;
          }
          case "QUIT":
            reply("221 Bye");
            control.end();
            break;
          default:
            reply("200 OK");
        }
      }
    });

    control.on("error", () => {});
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("control listener has no port");
  }

  handle.port = address.port;
  handle.close = () =>
    new Promise<void>((resolve) => {
      // Sockets left open by an abandoned transfer would keep `close` pending
      // forever, which shows up as a hung afterAll rather than as anything
      // informative.
      for (const socket of openSockets) socket.destroy();
      for (const dataServer of openDataServers) dataServer.close();
      openSockets.clear();
      openDataServers.clear();
      server.close(() => resolve());
    });

  return handle as FtpServerHandle;
}
