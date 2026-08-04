import { describe, expect, test } from "bun:test";
import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import { orderCommandReceipts } from "./orders";

const columnByName = (table: AnyPgTable, name: string) =>
  getTableConfig(table).columns.find((column) => column.name === name);

const foreignKeyByColumnName = (table: AnyPgTable, name: string) =>
  getTableConfig(table).foreignKeys.find((foreignKey) =>
    foreignKey.reference().columns.some((column) => column.name === name),
  );

describe("orders schema", () => {
  test("stores durable actor-scoped order command receipts", () => {
    expect(getTableConfig(orderCommandReceipts).name).toBe("order_command_receipts");
    expect(
      ["actor_user_id", "command_key", "request_fingerprint", "order_id", "result", "created_at"].map(
        (name) => {
          const column = columnByName(orderCommandReceipts, name);
          return [column?.name, column?.getSQLType(), column?.notNull];
        },
      ),
    ).toEqual([
      ["actor_user_id", "text", true],
      ["command_key", "text", true],
      ["request_fingerprint", "text", true],
      ["order_id", "text", true],
      ["result", "jsonb", true],
      ["created_at", "timestamp with time zone", true],
    ]);

    const config = getTableConfig(orderCommandReceipts);
    expect(config.uniqueConstraints.map((candidate) => candidate.name)).toContain(
      "order_command_receipts_actor_user_id_command_key_key",
    );
    expect(foreignKeyByColumnName(orderCommandReceipts, "actor_user_id")?.onDelete).toBe("restrict");
    expect(foreignKeyByColumnName(orderCommandReceipts, "order_id")?.onDelete).toBe("restrict");
  });
});
