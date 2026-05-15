import { describe, expect, it } from "vitest";
import { generateJson } from "./json";
import type { ScanResult } from "../types";

function result(findings: ScanResult["findings"]): ScanResult {
  return {
    projectPath: "/tmp/demo-miniapp",
    scannedAt: "2026-05-14T10:00:00.000Z",
    adapters: [
      { adapterName: "secret-scanner", status: "success", findings: [] },
    ],
    findings,
  };
}

describe("generateJson", () => {
  it("空 Findings 输出有效 JSON", () => {
    const json = generateJson(result([]));
    const parsed = JSON.parse(json);

    expect(parsed.projectPath).toBe("/tmp/demo-miniapp");
    expect(parsed.findings).toEqual([]);
    expect(parsed.adapters).toHaveLength(1);
  });

  it("包含 Finding 时序列化所有字段", () => {
    const json = generateJson(
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
      ]),
    );
    const parsed = JSON.parse(json);

    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].id).toBe("secret-1");
    expect(parsed.findings[0].severity).toBe("critical");
    expect(parsed.findings[0].filePath).toBe("/tmp/demo-miniapp/config.js");
    expect(parsed.findings[0].line).toBe(3);
  });

  it("输出格式化为 2 空格缩进", () => {
    const json = generateJson(result([]));

    // Should have newlines and 2-space indentation
    expect(json).toContain('\n  "projectPath"');
  });

  it("包含扫描时间和适配器状态", () => {
    const json = generateJson(
      result([
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
    const parsed = JSON.parse(json);

    expect(parsed.scannedAt).toBe("2026-05-14T10:00:00.000Z");
    expect(parsed.adapters[0].adapterName).toBe("secret-scanner");
    expect(parsed.adapters[0].status).toBe("success");
  });
});
