import { describe, it, expect } from "vitest";
import { dedup } from "./dedup";
import type { Finding } from "./types";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "test-1",
    title: "测试问题",
    severity: "high",
    category: "security",
    filePath: "src/app.js",
    line: 10,
    evidence: "API_KEY=xxx",
    whyItMatters: "密钥泄露会导致安全事件",
    recommendation: "使用环境变量",
    source: "secret-scanner",
    ...overrides,
  };
}

describe("dedup", () => {
  it("空数组返回空", () => {
    expect(dedup([])).toEqual([]);
  });

  it("无重复时原样返回", () => {
    const findings = [
      makeFinding({ id: "a", filePath: "a.js", line: 1 }),
      makeFinding({ id: "b", filePath: "b.js", line: 1 }),
    ];
    expect(dedup(findings)).toHaveLength(2);
  });

  it("同文件同行同问题的密钥去重为 1 条", () => {
    const findings = [
      makeFinding({ id: "a", filePath: "config.js", line: 5, source: "secret-scanner" }),
      makeFinding({ id: "b", filePath: "config.js", line: 5, source: "secret-scanner" }),
    ];
    const result = dedup(findings);
    expect(result).toHaveLength(1);
    expect(result[0].filePath).toBe("config.js");
    expect(result[0].line).toBe(5);
  });

  it("不同行不合并", () => {
    const findings = [
      makeFinding({ id: "a", filePath: "config.js", line: 5 }),
      makeFinding({ id: "b", filePath: "config.js", line: 20 }),
    ];
    expect(dedup(findings)).toHaveLength(2);
  });

  it("不同文件不合并", () => {
    const findings = [
      makeFinding({ id: "a", filePath: "a.js", line: 5 }),
      makeFinding({ id: "b", filePath: "b.js", line: 5 }),
    ];
    expect(dedup(findings)).toHaveLength(2);
  });

  it("不同适配器发现同一行同一问题 — 合并但保留多个来源标注", () => {
    const findings = [
      makeFinding({ id: "a", filePath: "config.js", line: 5, source: "secret-scanner" }),
      makeFinding({ id: "b", filePath: "config.js", line: 5, source: "rule-engine" }),
    ];
    const result = dedup(findings);
    // 应该合并为一条
    expect(result).toHaveLength(1);
  });

  it("同文件同行不同问题不合并", () => {
    const findings = [
      makeFinding({ id: "a", title: "API 接口无鉴权", filePath: "api/order.js", line: 4 }),
      makeFinding({ id: "b", title: "数据查询无用户归属校验 (潜在 IDOR)", filePath: "api/order.js", line: 4 }),
    ];

    expect(dedup(findings)).toHaveLength(2);
  });
});
