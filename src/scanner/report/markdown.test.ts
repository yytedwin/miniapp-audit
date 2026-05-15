import { describe, expect, it } from "vitest";
import { generateMarkdown } from "./markdown";
import type { ScanResult } from "../types";

function result(findings: ScanResult["findings"]): ScanResult {
  return {
    projectPath: "/tmp/demo-miniapp",
    scannedAt: "2026-05-14T10:00:00.000Z",
    adapters: [
      { adapterName: "secret-scanner", status: "success", findings: [] },
      { adapterName: "payment-rule", status: "success", findings: [] },
    ],
    findings,
  };
}

describe("generateMarkdown", () => {
  it("空结果输出未发现问题", () => {
    const markdown = generateMarkdown(result([]));

    expect(markdown).toContain("# 小程序上线前安全检查报告");
    expect(markdown).toContain("未发现安全问题");
    expect(markdown).toContain("可以上线");
  });

  it("按严重等级输出发现项和修复建议", () => {
    const markdown = generateMarkdown(
      result([
        {
          id: "secret-1",
          title: "API Key 明文硬编码",
          severity: "critical",
          category: "security",
          filePath: "/tmp/demo-miniapp/config.js",
          line: 3,
          evidence: 'const API_KEY = "sk-live-xxx"',
          whyItMatters: "密钥泄露可导致服务被恶意使用",
          recommendation: "改用环境变量",
          source: "secret-scanner",
        },
        {
          id: "payment-1",
          title: "支付回调无幂等处理",
          severity: "high",
          category: "payment",
          whyItMatters: "重复回调可能导致重复发货",
          recommendation: "按订单号检查处理状态",
          source: "payment-rule",
        },
      ]),
    );

    expect(markdown).toContain("## 阻塞上线 (1 个问题)");
    expect(markdown).toContain("## 高危 (1 个问题)");
    expect(markdown).toContain("API Key 明文硬编码");
    expect(markdown).toContain("支付回调无幂等处理");
    expect(markdown).toContain("改用环境变量");
  });
});
