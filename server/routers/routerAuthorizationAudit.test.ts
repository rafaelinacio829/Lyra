import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routersDirectory = join(process.cwd(), "server", "routers");

describe("auditoria de autorização dos routers", () => {
  it("exige guarda de tenant em todos os routers de produção que recebem tenantId", () => {
    const sourceFiles = readdirSync(routersDirectory).filter(file => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    const missingGuards = sourceFiles.filter(file => {
      const source = readFileSync(join(routersDirectory, file), "utf8");
      return source.includes("tenantId") && !/requireTenantAccess|requireTenantAdmin|platformAdminProcedure/.test(source);
    });
    expect(missingGuards).toEqual([]);
  });
});
