import { describe, expect, it } from "vitest";
import { generateHtml } from "./html";
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

describe("generateHtml", () => {
  it("空 Findings 输出完整 HTML5 文档", () => {
    const html = generateHtml(result([]));

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("未发现安全问题");
  });

  it("输出项目路径和扫描时间", () => {
    const html = generateHtml(result([]));

    expect(html).toContain("/tmp/demo-miniapp");
    expect(html).toContain("2026-05-14T10:00:00.000Z");
  });

  it("按严重等级分组输出 Findings", () => {
    const html = generateHtml(
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

    expect(html).toContain("阻塞上线");
    expect(html).toContain("高危");
    expect(html).toContain("API Key 明文硬编码");
    expect(html).toContain("支付回调无幂等处理");
    expect(html).toContain("改用环境变量");
    expect(html).toContain("config.js");
  });

  it("内联 CSS 不引用外部资源", () => {
    const html = generateHtml(result([]));

    // No external CSS/JS references
    expect(html).not.toContain('<link rel="stylesheet"');
    expect(html).not.toContain('<script src=');
    expect(html).toContain("<style>");
  });

  it("适配器失败时显示警告", () => {
    const r = result([]);
    r.adapters = [
      {
        adapterName: "secret-scanner",
        status: "failed",
        findings: [],
        error: "gitleaks not installed",
      },
    ];

    const html = generateHtml(r);

    expect(html).toContain("扫描状态");
    expect(html).toContain("secret-scanner");
    expect(html).toContain("gitleaks not installed");
  });
});
