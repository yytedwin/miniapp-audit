import { describe, expect, test } from "vitest";
import {
  createAdviceDocumentFileName,
  generateAdviceDocument,
} from "./advice";
import type { ScanResult } from "../types";

const result: ScanResult = {
  projectPath: "/tmp/demo-miniapp",
  scannedAt: "2026-05-15T10:00:00.000Z",
  adapters: [
    {
      adapterName: "secret-scanner",
      status: "success",
      findings: [],
    },
  ],
  findings: [
    {
      id: "secret-env",
      title: ".env 文件被提交到仓库",
      severity: "critical",
      category: "security",
      filePath: ".env",
      line: 1,
      evidence: "API_KEY=sk-demo",
      whyItMatters: "泄露的密钥可能被第三方直接调用线上资源。",
      recommendation: "移除 .env 文件，轮换已经泄露的密钥，并改用安全配置注入。",
      references: ["https://owasp.org/www-project-top-ten/"],
      source: "secret-scanner",
    },
    {
      id: "privacy-api",
      title: "隐私接口缺少弹窗说明",
      severity: "high",
      category: "privacy",
      filePath: "pages/index/index.js",
      whyItMatters: "缺少说明会影响平台审核和用户授权透明度。",
      recommendation: "在调用前展示用途说明，并补齐隐私协议中的对应条目。",
      source: "privacy-rule",
    },
  ],
};

describe("generateAdviceDocument", () => {
  test("generates a remediation document with grouped findings and actions", () => {
    const document = generateAdviceDocument(result);

    expect(document).toContain("# 小程序上线问题整改建议书");
    expect(document).toContain("## 上线判断");
    expect(document).toContain("不建议上线");
    expect(document).toContain("## 优先整改顺序");
    expect(document).toContain("1. 阻塞上线");
    expect(document).toContain("## 阻塞上线 (1 个)");
    expect(document).toContain("### 1. .env 文件被提交到仓库");
    expect(document).toContain("移除 .env 文件，轮换已经泄露的密钥");
    expect(document).toContain("## 高危 (1 个)");
    expect(document).toContain("### 2. 隐私接口缺少弹窗说明");
    expect(document).toContain("## 复查清单");
    expect(document).toContain("- [ ] 已重新运行扫描并确认阻塞上线问题为 0");
  });

  test("records a pass document when no findings exist", () => {
    const document = generateAdviceDocument({ ...result, findings: [] });

    expect(document).toContain("当前扫描未发现问题");
    expect(document).toContain("可作为本次上线前检查留档");
  });

  test("creates a readable local markdown filename", () => {
    expect(createAdviceDocumentFileName(result)).toBe(
      "miniapp-audit-advice-demo-miniapp-2026-05-15.md",
    );
  });
});
