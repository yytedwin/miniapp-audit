import { readFile } from "fs/promises";
import { basename } from "path";
import type { Finding, ScannerAdapter, ScanOptions } from "../types";

async function* walkJSFiles(
  dir: string,
  exclude: string[] = [],
): AsyncGenerator<string> {
  const { readdir } = await import("fs/promises");
  const { join } = await import("path");
  const MAX_DEPTH = 50;
  const stack: { path: string; depth: number }[] = [{ path: dir, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.depth > MAX_DEPTH) continue;

    let entries;
    try {
      entries = await readdir(current.path, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(current.path, entry.name);
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      if (exclude.includes(entry.name)) continue;

      if (entry.isDirectory()) {
        stack.push({ path: fullPath, depth: current.depth + 1 });
      } else if (/\.(js|ts|jsx|tsx)$/.test(entry.name)) {
        yield fullPath;
      }
    }
  }
}

const PAYMENT_RULES = [
  {
    name: "no-signature-verification",
    check: (content: string): boolean => {
      // Has payment callback keywords but no signature verification
      const hasPaymentCallback = /paymentCallback|payment_callback|notify_url|wx\.requestPayment/.test(content);
      const hasSignatureVerify = /verifySignature|checkSign|verifySign|verify.*sign|验签|签名验证/.test(content);
      return hasPaymentCallback && !hasSignatureVerify;
    },
    title: "支付回调缺少签名验证",
    severity: "critical" as const,
    whyItMatters: "回调不验签意味着攻击者可以伪造支付成功通知，导致资金损失",
    recommendation: "使用微信支付 SDK 的验签方法验证每个回调请求的签名有效性",
  },
  {
    name: "trust-frontend-amount",
    check: (content: string): boolean => {
      // Order creation that uses req.body.amount directly
      const hasOrderCreation = /createOrder|create_order|createPayment|create_payment|下单/.test(content);
      const trustsFrontendAmount = /req\.body\.amount|req\.body\.price|req\.body\.total|前端.*金额|amount.*body/.test(content);
      return hasOrderCreation && trustsFrontendAmount;
    },
    title: "订单金额信任前端传入",
    severity: "critical" as const,
    whyItMatters: "前端传入的金额可被任意修改，攻击者可以 1 分钱购买任意商品",
    recommendation: "服务端从数据库中查询商品价格计算订单金额，不从请求参数中读取",
  },
  {
    name: "no-idempotency",
    check: (content: string): boolean => {
      // Payment callback without idempotency handling
      const hasCallback = /paymentCallback|payment_callback|回调/.test(content);
      const hasIdempotency = /idempoten|幂等|duplicate|重复.*检查|already.*paid|已支付|去重/.test(content);
      return hasCallback && !hasIdempotency;
    },
    title: "支付回调无幂等处理",
    severity: "high" as const,
    whyItMatters: "微信可能重复发送回调通知，无幂等处理会导致重复发货或重复扣款",
    recommendation: "在回调处理中根据 out_trade_no 检查订单状态，已处理的订单直接返回成功",
  },
];

function stripJsComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function createPaymentRule(): ScannerAdapter {
  return {
    name: "payment-rule",
    isAvailable: () => true,

    async scan(projectPath: string, options?: ScanOptions): Promise<Finding[]> {
      const findings: Finding[] = [];

      for await (const filePath of walkJSFiles(projectPath, options?.exclude)) {
        let content: string;
        try {
          content = await readFile(filePath, "utf-8");
        } catch {
          continue;
        }

        const codeOnly = stripJsComments(content);

        for (const rule of PAYMENT_RULES) {
          if (rule.check(codeOnly)) {
            const lines = content.split("\n");
            const relevantLine = lines.find(
              (l) => /payment|order|callback|amount|req\.body/.test(l)
            );
            const lineIndex = relevantLine ? lines.indexOf(relevantLine) : -1;

            findings.push({
              id: `payment-${rule.name}-${basename(filePath)}`,
              title: rule.title,
              severity: rule.severity,
              category: "payment",
              filePath,
              line: lineIndex >= 0 ? lineIndex + 1 : undefined,
              evidence: relevantLine?.trim().slice(0, 100),
              whyItMatters: rule.whyItMatters,
              recommendation: rule.recommendation,
              source: "payment-rule",
            });
          }
        }
      }

      return findings;
    },
  };
}
