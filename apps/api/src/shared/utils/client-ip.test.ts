import { describe, expect, it } from "bun:test";
import {
  canonicalizePeerAddress,
  getClientIp,
  normalizeIpForInet,
  type IpServer,
} from "./client-ip";

describe("canonicalizePeerAddress", () => {
  it("collapses IPv4-mapped IPv6", () => {
    expect(canonicalizePeerAddress("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(canonicalizePeerAddress("::FFFF:10.0.0.2")).toBe("10.0.0.2");
  });

  it("strips IPv6 zone id", () => {
    expect(canonicalizePeerAddress("fe80::1%lo0")).toBe("fe80::1");
  });
});

describe("normalizeIpForInet", () => {
  it("keeps IPv4", () => {
    expect(normalizeIpForInet("127.0.0.1")).toBe("127.0.0.1");
  });

  it("keeps IPv6", () => {
    expect(normalizeIpForInet("::1")).toBe("::1");
  });

  it("keeps IPv4-mapped form as dotted IPv4", () => {
    expect(normalizeIpForInet("::ffff:192.168.1.1")).toBe("192.168.1.1");
  });

  it("drops unknown sentinel", () => {
    expect(normalizeIpForInet("unknown")).toBeUndefined();
    expect(normalizeIpForInet("UNKNOWN")).toBeUndefined();
  });

  it("drops empty", () => {
    expect(normalizeIpForInet("")).toBeUndefined();
    expect(normalizeIpForInet("   ")).toBeUndefined();
    expect(normalizeIpForInet(null)).toBeUndefined();
    expect(normalizeIpForInet(undefined)).toBeUndefined();
  });

  it("drops junk", () => {
    expect(normalizeIpForInet("not-an-ip")).toBeUndefined();
  });
});

describe("getClientIp peer fallback", () => {
  it("uses Bun server.requestIP when proxy off", () => {
    const request = new Request("http://localhost/session");
    const server: IpServer = {
      requestIP: () => ({ address: "::ffff:127.0.0.1" }),
    };
    expect(getClientIp({ request, server })).toBe("127.0.0.1");
  });

  it("returns unknown for bare Request without peer", () => {
    const request = new Request("http://localhost/session");
    expect(getClientIp(request)).toBe("unknown");
  });
});
