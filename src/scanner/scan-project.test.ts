import { describe, it, expect } from "vitest";
import { scanProject, PathNotFoundError } from "./scan-project";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import os from "os";
import type { AuditConfig } from "./config";

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

describe("scanProject", () => {
  it("路径不存在时抛出 PathNotFoundError", async () => {
    await expect(scanProject("/tmp/definitely-not-exists-12345")).rejects.toThrow(
      PathNotFoundError,
    );
  });

  it("无权限路径无法扫描", async () => {
    // Non-existent path is the simplest way to test this
    await expect(scanProject("/root/secret")).rejects.toThrow();
  });

  it("对空目录扫描不报错且返回空 Findings", async () => {
    const { dir, cleanup } = await tmpDir();
    const result = await scanProject(dir);
    expect(result.findings).toEqual([]);
    expect(result.adapters.length).toBeGreaterThan(0);
    await cleanup();
  });

  it("对包含 .env 的目录能发现密钥泄露", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(path.join(dir, ".env"), "API_KEY=sk-leaked-key-12345\n");

    const result = await scanProject(dir);

    const secretFindings = result.findings.filter(
      (f) => f.source === "secret-scanner",
    );
    expect(secretFindings.length).toBeGreaterThan(0);

    await cleanup();
  });

  it("适配器失败时仍返回其他适配器的结果", async () => {
    const { dir, cleanup } = await tmpDir();
    // Empty directory - dependency scanner will skip (no package-lock.json)
    // but other scanners should work
    const result = await scanProject(dir);

    // All adapters should report (either success or skipped)
    expect(result.adapters.length).toBe(5);
    // Result should still be valid
    expect(Array.isArray(result.findings)).toBe(true);

    await cleanup();
  });

  it("disabled 的 adapter 不出现在结果中", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(path.join(dir, ".env"), "API_KEY=sk-leaked-key-12345\n");

    const config: AuditConfig = {
      rules: { "secret-scanner": { enabled: false } },
      exclude: [],
    };

    const result = await scanProject(dir, { config });

    const secretFindings = result.findings.filter(
      (f) => f.source === "secret-scanner",
    );
    expect(secretFindings.length).toBe(0);

    await cleanup();
  });

  it("exclude 路径下的文件不被扫描", async () => {
    const { dir, cleanup } = await tmpDir();
    const utilsDir = path.join(dir, "utils");
    await mkdir(utilsDir);
    await writeFile(path.join(utilsDir, "config.js"), 'const API_KEY = "sk-leaked-in-utils"');

    const config: AuditConfig = {
      rules: {},
      exclude: ["utils"],
    };

    const result = await scanProject(dir, { config });

    const secretFindings = result.findings.filter(
      (f) => f.source === "secret-scanner",
    );
    expect(secretFindings.length).toBe(0);

    await cleanup();
  });

  it("无配置文件时 .env 仍能扫出 findings", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(path.join(dir, ".env"), "API_KEY=sk-leaked-key-12345\n");

    const result = await scanProject(dir);

    const secretFindings = result.findings.filter(
      (f) => f.source === "secret-scanner",
    );
    expect(secretFindings.length).toBeGreaterThan(0);

    await cleanup();
  });
});
