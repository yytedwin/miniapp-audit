import { describe, it, expect } from "vitest";
import { createAuthzRule } from "./authz";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import os from "os";

async function tmpDir() {
  const dir = path.join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  return {
    dir,
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

describe("AuthzRule", () => {
  it("接口无鉴权中间件", async () => {
    const { dir, cleanup } = await tmpDir();
    await mkdir(path.join(dir, "api"), { recursive: true });
    await writeFile(
      path.join(dir, "api/users.js"),
      `// user data API
exports.handler = async function(req, res) {
  const users = await db.query("SELECT * FROM users");
  res.json(users);
};\n`
    );

    const scanner = createAuthzRule();
    const findings = await scanner.scan(dir);

    const authFinding = findings.find((f) =>
      f.title.includes("鉴权") || f.title.includes("权限") || f.title.includes("认证")
    );
    expect(authFinding).toBeDefined();

    await cleanup();
  });

  it("管理员账号硬编码", async () => {
    const { dir, cleanup } = await tmpDir();
    await mkdir(path.join(dir, "config"), { recursive: true });
    await writeFile(
      path.join(dir, "config/admin.js"),
      `const ADMIN_ACCOUNT = {
  username: "admin",
  password: "admin123",
  role: "superadmin"
};\n`
    );

    const scanner = createAuthzRule();
    const findings = await scanner.scan(dir);

    const adminFinding = findings.find((f) =>
      f.title.includes("硬编码") || f.title.includes("admin") || f.title.includes("管理员")
    );
    expect(adminFinding).toBeDefined();

    await cleanup();
  });

  it("用户数据越权读取 — 通过 ID 直接查询无归属校验", async () => {
    const { dir, cleanup } = await tmpDir();
    await mkdir(path.join(dir, "api"), { recursive: true });
    await writeFile(
      path.join(dir, "api/order.js"),
      `// 订单查询接口
exports.getOrder = async function(req, res) {
  const { orderId } = req.params;
  // 直接查，没有校验 order 是否属于当前用户
  const order = await db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
  res.json(order);
};\n`
    );

    const scanner = createAuthzRule();
    const findings = await scanner.scan(dir);

    const privFinding = findings.find((f) =>
      f.title.includes("越权") || f.title.includes("归属") || f.title.includes("IDOR")
    );
    expect(privFinding).toBeDefined();

    await cleanup();
  });

  it("小程序云数据库 doc(id).get 缺少用户归属校验", async () => {
    const { dir, cleanup } = await tmpDir();
    await mkdir(path.join(dir, "pages", "order"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/order/order.js"),
      `exports.getOrder = async function (req, res) {
  const { orderId } = req.params;
  const order = await db.collection("orders").doc(orderId).get();
  res.json({ data: order.data });
};\n`
    );

    const scanner = createAuthzRule();
    const findings = await scanner.scan(dir);

    expect(findings.some((f) => f.title.includes("IDOR"))).toBe(true);

    await cleanup();
  });
});
