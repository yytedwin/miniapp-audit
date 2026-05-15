import { describe, expect, it } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { loadConfig } from "./config";
import { tmpdir } from "os";

const TEST_CONFIG = {
  rules: {
    "secret-scanner": { enabled: false },
    "payment-rule": { enabled: true },
  },
  exclude: ["node_modules", "dist", ".cache"],
};

async function withTempDir(
  fn: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = join(tmpdir(), `config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("loadConfig", () => {
  it("无配置文件时返回默认值", async () => {
    await withTempDir(async (dir) => {
      const config = await loadConfig(dir);

      expect(config.rules).toEqual({});
      expect(config.exclude).toEqual(["node_modules", ".git", "dist"]);
    });
  });

  it("加载合法配置文件", async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, "miniapp-audit.config.json"),
        JSON.stringify(TEST_CONFIG, null, 2),
      );

      const config = await loadConfig(dir);

      expect(config.rules).toEqual(TEST_CONFIG.rules);
      expect(config.exclude).toEqual(TEST_CONFIG.exclude);
    });
  });

  it("配置文件 JSON 语法错误时抛异常", async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, "miniapp-audit.config.json"),
        "{ invalid json }",
      );

      await expect(loadConfig(dir)).rejects.toThrow();
    });
  });

  it("exclude 字段缺失时使用默认值", async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, "miniapp-audit.config.json"),
        JSON.stringify({ rules: { "secret-scanner": { enabled: false } } }),
      );

      const config = await loadConfig(dir);

      expect(config.exclude).toEqual(["node_modules", ".git", "dist"]);
      expect(config.rules).toEqual({ "secret-scanner": { enabled: false } });
    });
  });

  it("rules 字段缺失时返回空 rules", async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        join(dir, "miniapp-audit.config.json"),
        JSON.stringify({ exclude: ["vendor"] }),
      );

      const config = await loadConfig(dir);

      expect(config.rules).toEqual({});
      expect(config.exclude).toEqual(["vendor"]);
    });
  });
});
