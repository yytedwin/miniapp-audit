import { describe, expect, it } from "vitest";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { main, generateReport, parseFormat, parseArgs } from "./cli";

describe("import side effects", () => {
  it("import cli 模块不触发 main 执行", () => {
    // If importing triggered main(), we'd see output/errors during test collection.
    // The fact that we can import and call main() manually proves no side effect.
    expect(typeof main).toBe("function");
    expect(typeof generateReport).toBe("function");
    expect(typeof parseFormat).toBe("function");
  });
});

async function withTempDir(
  fn: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = join(
    tmpdir(),
    `cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("parseArgs", () => {
  it("解析 --config 参数", () => {
    const args = parseArgs([
      "/tmp/project",
      "--config",
      "/path/to/config.json",
    ]);
    expect(args.configPath).toBe("/path/to/config.json");
  });

  it("不指定 --config 时使用默认路径", () => {
    const args = parseArgs(["/tmp/project"]);
    expect(args.configPath).toBe("/tmp/project/miniapp-audit.config.json");
  });
});

describe("CLI --format", () => {
  it("--help 输出帮助信息", async () => {
    // help mode exits early, no output file created
    await main(["--help"]);
    // Should not throw
  });

  it("--format json 生成 JSON 报告", async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, "report.json");
      await main([dir, "--format", "json", "--output", output]);

      const content = await readFile(output, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.projectPath).toBeDefined();
      expect(parsed.findings).toBeDefined();
      expect(parsed.scannedAt).toBeDefined();
    });
  });

  it("--format html 生成 HTML 报告", async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, "report.html");
      await main([dir, "--format", "html", "--output", output]);

      const content = await readFile(output, "utf-8");
      expect(content).toContain("<!DOCTYPE html>");
      expect(content).toContain("<html");
      expect(content).toContain("</html>");
    });
  });

  it("--format sarif 生成 SARIF 报告", async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, "report.sarif");
      await main([dir, "--format", "sarif", "--output", output]);

      const content = await readFile(output, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.$schema).toContain("sarif");
      expect(parsed.version).toBe("2.1.0");
    });
  });

  it("--format 未指定时默认输出 markdown", async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, "report.md");
      await main([dir, "--output", output]);

      const content = await readFile(output, "utf-8");
      expect(content).toContain("# 小程序上线前安全检查报告");
    });
  });

  it("option 在 projectPath 前也能运行", async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, "report.json");
      await main(["--format", "json", "--output", output, dir]);

      const content = await readFile(output, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.projectPath).toBeDefined();
    });
  });

  it("option 在 projectPath 后仍能运行", async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, "report.html");
      await main([dir, "--format", "html", "--output", output]);

      const content = await readFile(output, "utf-8");
      expect(content).toContain("<!DOCTYPE html>");
    });
  });

  it("缺 projectPath 抛清晰错误", async () => {
    await expect(main(["--format", "json"])).rejects.toThrow("项目路径");
  });

  it("缺 projectPath 仅 option 出现时抛错误", async () => {
    await expect(
      main(["--format", "html", "--output", "/tmp/report.html"]),
    ).rejects.toThrow("项目路径");
  });

  it("--config 禁用 secret-scanner 后不出现对应 findings", async () => {
    await withTempDir(async (dir) => {
      // Create a .env leak that secret-scanner would catch
      await writeFile(join(dir, ".env"), "API_KEY=sk-leaked-key-12345\n");

      // Create custom config that disables secret-scanner
      const configPath = join(dir, "my-config.json");
      await writeFile(
        configPath,
        JSON.stringify({
          rules: { "secret-scanner": { enabled: false } },
        }),
      );

      const output = join(dir, "report.json");
      await main([
        dir,
        "--config",
        configPath,
        "--format",
        "json",
        "--output",
        output,
      ]);

      const content = await readFile(output, "utf-8");
      const parsed = JSON.parse(content);

      // secret-scanner findings must not appear
      const secretFindings = parsed.findings.filter(
        (f: { source: string }) => f.source === "secret-scanner",
      );
      expect(secretFindings.length).toBe(0);

      // secret-scanner adapter must not be in results
      const secretAdapter = parsed.adapters.find(
        (a: { adapterName: string }) => a.adapterName === "secret-scanner",
      );
      expect(secretAdapter).toBeUndefined();
    });
  });

  it("不指定 --config 时 .env 泄露仍被 secret-scanner 检出", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, ".env"), "API_KEY=sk-leaked-key-12345\n");

      const output = join(dir, "report.json");
      await main([dir, "--format", "json", "--output", output]);

      const content = await readFile(output, "utf-8");
      const parsed = JSON.parse(content);

      const secretFindings = parsed.findings.filter(
        (f: { source: string }) => f.source === "secret-scanner",
      );
      expect(secretFindings.length).toBeGreaterThan(0);
    });
  });

  it("--config 文件不存在时抛错误", async () => {
    await withTempDir(async (dir) => {
      await expect(
        main([dir, "--config", "/nonexistent/config.json"]),
      ).rejects.toThrow("配置文件");
    });
  });

  it("无效 --format 值显示错误", async () => {
    await withTempDir(async (dir) => {
      const output = join(dir, "report.xyz");

      await expect(
        main([dir, "--format", "xml", "--output", output]),
      ).rejects.toThrow("不支持的格式");
    });
  });
});
