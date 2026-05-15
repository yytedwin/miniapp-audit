import { describe, it, expect, vi } from "vitest";
import { createDependencyScanner } from "./dependency-scanner";
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

// Mock 一个带漏洞的 package-lock.json
const vulnerableLockJson = {
  name: "test-project",
  lockfileVersion: 3,
  packages: {
    "node_modules/vulnerable-lib": {
      version: "1.0.0",
      resolved: "https://registry.npmjs.org/vulnerable-lib/-/vulnerable-lib-1.0.0.tgz",
    },
  },
};

describe("DependencyScanner", () => {
  it("发现 package-lock.json 中包含已知高危依赖", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "package-lock.json"),
      JSON.stringify(vulnerableLockJson)
    );

    // Mock npm API 返回一个漏洞
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulnerable: {
          "vulnerable-lib": {
            "1.0.0": {
              severity: "high",
              title: "Prototype Pollution in vulnerable-lib",
              recommendation: "Upgrade to 1.0.1",
            },
          },
        },
      }),
    });

    const scanner = createDependencyScanner({ fetch: mockFetch as typeof fetch });
    const findings = await scanner.scan(dir);

    expect(findings.length).toBeGreaterThan(0);
    const vulnFinding = findings[0];
    expect(vulnFinding.severity).toBe("high");
    expect(vulnFinding.category).toBe("dependency");
    expect(vulnFinding.filePath).toContain("package-lock.json");

    await cleanup();
  });

  it("无 package-lock.json 时跳过", async () => {
    const { dir, cleanup } = await tmpDir();

    const scanner = createDependencyScanner();
    const findings = await scanner.scan(dir);

    expect(findings).toHaveLength(0);

    await cleanup();
  });

  it("npm API 返回 429 时降级", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "package-lock.json"),
      JSON.stringify(vulnerableLockJson)
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const scanner = createDependencyScanner({ fetch: mockFetch as typeof fetch });
    const findings = await scanner.scan(dir);

    // 降级后可能返回空或来自本地库的结果
    expect(Array.isArray(findings)).toBe(true);

    await cleanup();
  });

  it("npm API 超时后降级", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "package-lock.json"),
      JSON.stringify(vulnerableLockJson)
    );

    const mockFetch = vi.fn().mockRejectedValue(new Error("Timeout"));

    const scanner = createDependencyScanner({ fetch: mockFetch as typeof fetch });
    const findings = await scanner.scan(dir);

    // 降级不应抛异常
    expect(Array.isArray(findings)).toBe(true);

    await cleanup();
  });
});
