import { describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import path from "path";
import { scanProject } from "./scan-project";

type ExpectedFindings = {
  expectedMinimum: number;
  criticalFindings: string[];
  highFindings: string[];
};

describe("vulnerable-miniapp fixture", () => {
  it("扫描结果覆盖 expected-findings.json 中列出的风险", async () => {
    const fixturePath = path.resolve("fixtures/vulnerable-miniapp");
    const expected = JSON.parse(
      await readFile(path.join(fixturePath, "expected-findings.json"), "utf-8"),
    ) as ExpectedFindings;

    const result = await scanProject(fixturePath);
    const titles = result.findings.map((finding) => finding.title);

    expect(result.findings.length).toBeGreaterThanOrEqual(expected.expectedMinimum);

    for (const title of expected.criticalFindings) {
      expect(titles).toContain(title);
      const finding = result.findings.find((item) => item.title === title);
      expect(finding?.severity).toBe("critical");
    }

    for (const title of expected.highFindings) {
      expect(titles).toContain(title);
      const finding = result.findings.find((item) => item.title === title);
      expect(finding?.severity).toBe("high");
    }
  });
});
