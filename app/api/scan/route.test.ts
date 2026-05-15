import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { POST } from "./route";

async function withTempProject(fn: (dir: string) => Promise<void>) {
  const dir = join(
    tmpdir(),
    `api-scan-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function request(host: string, body: unknown) {
  return new NextRequest(`http://${host}/api/scan`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/scan", () => {
  it("拒绝非 localhost 请求", async () => {
    const res = await POST(request("example.com", { projectPath: "/tmp" }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "Web 扫描接口只允许在本机 localhost 使用",
    });
  });

  it("缺少 projectPath 时返回 400", async () => {
    const res = await POST(request("localhost:3000", {}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "请提供项目路径" });
  });

  it("localhost 请求可扫描本地项目", async () => {
    await withTempProject(async (dir) => {
      await writeFile(join(dir, ".env"), "API_KEY=sk-test-key-1234567890\n");

      const res = await POST(request("localhost:3000", { projectPath: dir }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.projectPath).toBe(dir);
      expect(body.findings.length).toBeGreaterThan(0);
    });
  });
});
