import { describe, it, expect } from "vitest";
import { createPaymentRule } from "./payment-callback";
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

describe("PaymentRule", () => {
  it("微信支付回调缺少签名验证", async () => {
    const { dir, cleanup } = await tmpDir();
    await mkdir(path.join(dir, "pages", "pay"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/pay/pay.js"),
      `exports.paymentCallback = function(req, res) {
  const { out_trade_no, total_fee } = req.body;
  updateOrder(out_trade_no, "paid");
};\n`
    );

    const scanner = createPaymentRule();
    const findings = await scanner.scan(dir);

    const payFinding = findings.find((f) =>
      f.title.includes("签名验证")
    );
    expect(payFinding).toBeDefined();
    expect(payFinding!.severity).toBe("critical");
    expect(payFinding!.category).toBe("payment");

    await cleanup();
  });

  it("注释里的验签文字不算真实验签", async () => {
    const { dir, cleanup } = await tmpDir();
    await mkdir(path.join(dir, "pages", "pay"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/pay/pay.js"),
      `// 支付回调处理 - 缺少签名验证
exports.paymentCallback = function(req, res) {
  // 这里没有验证微信支付签名
  updateOrder(req.body.out_trade_no, "paid");
};\n`
    );

    const scanner = createPaymentRule();
    const findings = await scanner.scan(dir);

    expect(findings.some((f) => f.title === "支付回调缺少签名验证")).toBe(true);

    await cleanup();
  });

  it("订单金额信任前端传入", async () => {
    const { dir, cleanup } = await tmpDir();
    await mkdir(path.join(dir, "pages", "order"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/order/order.js"),
      `// 下单逻辑
exports.createOrder = function(req, res) {
  const amount = req.body.amount; // 直接使用前端传来的金额
  const order = createPayment(amount);
  res.json(order);
};\n`
    );

    const scanner = createPaymentRule();
    const findings = await scanner.scan(dir);

    const amountFinding = findings.find((f) =>
      f.title.includes("金额") || f.title.includes("前端")
    );
    expect(amountFinding).toBeDefined();

    await cleanup();
  });

  it("回调有验签时不报问题", async () => {
    const { dir, cleanup } = await tmpDir();
    await mkdir(path.join(dir, "pages", "pay"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/pay/callback.js"),
      `exports.paymentCallback = function(req, res) {
  const sign = req.headers["x-wx-signature"];
  if (!verifySignature(req.body, sign)) {
    return res.status(400).send("invalid signature");
  }
  updateOrder(req.body.out_trade_no, "paid");
};\n`
    );

    const scanner = createPaymentRule();
    const findings = await scanner.scan(dir);

    // 有验签逻辑，不应报验签缺失
    const payFindings = findings.filter((f) => f.title.includes("验签"));
    expect(payFindings).toHaveLength(0);

    await cleanup();
  });
});
