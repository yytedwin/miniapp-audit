import { describe, expect, it } from "vitest";
import { generateSarif } from "./sarif";
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

describe("generateSarif", () => {
  it("空 Findings 输出有效 SARIF 结构", () => {
    const json = generateSarif(result([]));
    const parsed = JSON.parse(json);

    expect(parsed.$schema).toBe(
      "https://docs.oasis-open.org/sarif/sarif/v2.1.0/csd01/schemas/sarif-schema-2.1.0.json",
    );
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].tool.driver.name).toBe("miniapp-audit");
    expect(parsed.runs[0].results).toEqual([]);
  });

  it("单条 Critical Finding 映射为 error", () => {
    const json = generateSarif(
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
    const r = parsed.runs[0].results[0];

    expect(r.level).toBe("error");
    expect(r.message.text).toContain("API Key 明文硬编码");
    expect(r.message.text).toContain("改用环境变量");
    expect(r.locations).toHaveLength(1);
    expect(r.locations[0].physicalLocation.artifactLocation.uri).toBe(
      "config.js",
    );
    expect(
      r.locations[0].physicalLocation.region.startLine,
    ).toBe(3);
  });

  it("severity → level 映射正确", () => {
    const severities = [
      { severity: "critical" as const, expectedLevel: "error" },
      { severity: "high" as const, expectedLevel: "warning" },
      { severity: "medium" as const, expectedLevel: "warning" },
      { severity: "low" as const, expectedLevel: "note" },
    ];

    for (const { severity, expectedLevel } of severities) {
      const json = generateSarif(
        result([
          {
            id: `test-${severity}`,
            title: "Test",
            severity,
            category: "security",
            whyItMatters: "test",
            recommendation: "test",
            source: "test",
          },
        ]),
      );
      const parsed = JSON.parse(json);
      expect(parsed.runs[0].results[0].level).toBe(expectedLevel);
    }
  });

  it("无 filePath 的 Finding 仍可输出", () => {
    const json = generateSarif(
      result([
        {
          id: "no-file",
          title: "无文件路径的发现",
          severity: "medium",
          category: "compliance",
          whyItMatters: "测试",
          recommendation: "修复",
          source: "privacy-rule",
        },
      ]),
    );
    const parsed = JSON.parse(json);
    const r = parsed.runs[0].results[0];

    expect(r.level).toBe("warning");
    expect(r.message.text).toContain("无文件路径的发现");
  });

  it("嵌套路径输出相对项目根目录的相对路径", () => {
    const json = generateSarif({
      projectPath: "/tmp/demo-miniapp",
      scannedAt: "2026-05-14T10:00:00.000Z",
      adapters: [],
      findings: [
        {
          id: "nested-1",
          title: "嵌套路径测试",
          severity: "high",
          category: "security",
          filePath: "/tmp/demo-miniapp/pages/index/config.js",
          line: 5,
          whyItMatters: "测试相对路径",
          recommendation: "修复",
          source: "test",
        },
      ],
    });
    const parsed = JSON.parse(json);
    const uri =
      parsed.runs[0].results[0].locations[0].physicalLocation
        .artifactLocation.uri;

    expect(uri).toBe("pages/index/config.js");
  });

  it("filePath 不在项目根目录下时保留原路径", () => {
    const json = generateSarif({
      projectPath: "/tmp/demo-miniapp",
      scannedAt: "2026-05-14T10:00:00.000Z",
      adapters: [],
      findings: [
        {
          id: "outside-1",
          title: "外部路径测试",
          severity: "medium",
          category: "security",
          filePath: "/other-project/src/app.js",
          line: 1,
          whyItMatters: "测试",
          recommendation: "修复",
          source: "test",
        },
      ],
    });
    const parsed = JSON.parse(json);
    const uri =
      parsed.runs[0].results[0].locations[0].physicalLocation
        .artifactLocation.uri;

    expect(uri).toBe("/other-project/src/app.js");
  });

  it("invocations 包含执行信息", () => {
    const json = generateSarif(result([]));
    const parsed = JSON.parse(json);
    const inv = parsed.runs[0].invocations[0];

    expect(inv.executionSuccessful).toBe(true);
    expect(inv.startTimeUtc).toBeDefined();
    expect(inv.endTimeUtc).toBeDefined();
  });
});
