import { describe, it, expect } from "vitest";
import { createSecretScanner } from "./secret-scanner";
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

describe("SecretScanner", () => {
  it("发现 .env 文件被提交", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, ".env"),
      "API_KEY=sk-abc123\nDB_PASSWORD=supersecret\n"
    );

    const scanner = createSecretScanner();
    const findings = await scanner.scan(dir);

    const envFinding = findings.find((f) => f.filePath?.endsWith(".env"));
    expect(envFinding).toBeDefined();
    expect(envFinding!.severity).toBe("critical");
    expect(envFinding!.category).toBe("security");

    await cleanup();
  });

  it("发现 .env 中未加引号的密钥", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, ".env"),
      [
        "API_KEY=sk-live-vulnerable-project-key-123456",
        "DB_PASSWORD=supersecretpassword123",
        "JWT_SECRET=my-jwt-secret-do-not-commit",
      ].join("\n"),
    );

    const scanner = createSecretScanner();
    const findings = await scanner.scan(dir);
    const titles = findings.map((finding) => finding.title);

    expect(titles).toContain("API Key 明文硬编码");
    expect(titles).toContain("数据库连接信息明文硬编码");
    expect(titles).toContain("JWT Secret 明文硬编码");

    await cleanup();
  });

  it("发现前端 JS 中硬编码 API Key", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "config.js"),
      'const API_KEY = "sk-live-1234567890abcdef";\n'
    );

    const scanner = createSecretScanner();
    const findings = await scanner.scan(dir);

    const apiKeyFinding = findings.find((f) =>
      f.title.includes("API Key") || f.title.includes("API key") || f.title.includes("密钥")
    );
    expect(apiKeyFinding).toBeDefined();
    expect(apiKeyFinding!.severity).toBe("critical");

    await cleanup();
  });

  it("发现 JWT Secret 明文", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "config.js"),
      'const JWT_SECRET = "my-super-secret-key-12345";\n'
    );

    const scanner = createSecretScanner();
    const findings = await scanner.scan(dir);

    const jwtFinding = findings.find((f) =>
      f.title.toLowerCase().includes("jwt")
    );
    expect(jwtFinding).toBeDefined();

    await cleanup();
  });

  it("发现数据库连接串含密码", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "db.js"),
      'const DB_URL = "mysql://admin:password123@localhost:3306/mydb";\n'
    );

    const scanner = createSecretScanner();
    const findings = await scanner.scan(dir);

    const dbFinding = findings.find((f) =>
      f.title.includes("数据库") || f.title.toLowerCase().includes("database") || f.title.toLowerCase().includes("db")
    );
    expect(dbFinding).toBeDefined();
    expect(dbFinding!.severity).toBe("critical");

    await cleanup();
  });

  it("发现云服务密钥", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "cloud.js"),
      'const secretId = "AKIDxxxxxxxxxxxxxxxxxxxxxxxxxxxx";\n' +
      'const secretKey = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";\n'
    );

    const scanner = createSecretScanner();
    const findings = await scanner.scan(dir);

    const cloudFinding = findings.find((f) =>
      f.title.includes("云服务") || f.title.includes("AKID") || f.title.toLowerCase().includes("cloud")
    );
    expect(cloudFinding).toBeDefined();

    await cleanup();
  });

  it("超过 10MB 的文件被跳过", async () => {
    const { dir, cleanup } = await tmpDir();
    // 创建一个大于 10MB 的标记，但我们用配置模拟
    // 实际测试：创建一个文件，设置很小的上限
    const bigFilePath = path.join(dir, "big.txt");
    // 写 1KB 内容，但设置 maxFileSize 为 500 bytes
    const bigContent = Buffer.alloc(1024, "x").toString();
    await writeFile(bigFilePath, bigContent);

    const scanner = createSecretScanner();
    const findings = await scanner.scan(dir, { maxFileSize: 500 });

    // big.txt 应该被跳过，不应有来自它的 findings
    const bigFileFindings = findings.filter((f) => f.filePath?.includes("big.txt"));
    expect(bigFileFindings).toHaveLength(0);

    await cleanup();
  });

  it("二进制文件被跳过", async () => {
    const { dir, cleanup } = await tmpDir();
    // 写一个看起来像二进制的内容（包含 null bytes）
    const binPath = path.join(dir, "image.bin");
    await writeFile(binPath, Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]));

    const scanner = createSecretScanner();
    const findings = await scanner.scan(dir);

    // 二进制文件不应被扫描
    const binFindings = findings.filter((f) => f.filePath?.includes("image.bin"));
    expect(binFindings).toHaveLength(0);

    await cleanup();
  });

  it("正常文件无密钥时不报问题", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "safe.js"),
      'const name = "hello";\nconsole.log(name);\n'
    );

    const scanner = createSecretScanner();
    const findings = await scanner.scan(dir);

    expect(findings).toHaveLength(0);

    await cleanup();
  });
});
