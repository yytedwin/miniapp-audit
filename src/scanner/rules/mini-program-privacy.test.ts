import { describe, it, expect } from "vitest";
import { createPrivacyRule } from "./mini-program-privacy";
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

describe("PrivacyRule", () => {
  it("使用 getLocation 但 app.json 缺少 requiredPrivateInfos", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "app.json"),
      JSON.stringify({ pages: ["pages/index/index"] })
    );
    await mkdir(path.join(dir, "pages", "index"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/index/index.js"),
      'wx.getLocation({ type: "wgs84", success: (res) => {} });\n'
    );

    const scanner = createPrivacyRule();
    const findings = await scanner.scan(dir);

    expect(findings.length).toBeGreaterThan(0);
    const locFinding = findings.find((f) => f.title.includes("getLocation") || f.title.includes("位置"));
    expect(locFinding).toBeDefined();
    expect(locFinding!.severity).toBe("critical");

    await cleanup();
  });

  it("使用 getUserProfile 但无用户授权声明", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "app.json"),
      JSON.stringify({ pages: ["pages/profile/profile"] })
    );
    await mkdir(path.join(dir, "pages", "profile"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/profile/profile.js"),
      'wx.getUserProfile({ desc: "获取用户信息", success: (res) => {} });\n'
    );

    const scanner = createPrivacyRule();
    const findings = await scanner.scan(dir);

    const profileFinding = findings.find((f) => f.title.includes("getUserProfile") || f.title.includes("用户信息"));
    expect(profileFinding).toBeDefined();

    await cleanup();
  });

  it("app.json 正确声明 requiredPrivateInfos 时不报问题", async () => {
    const { dir, cleanup } = await tmpDir();
    await writeFile(
      path.join(dir, "app.json"),
      JSON.stringify({
        pages: ["pages/index/index"],
        requiredPrivateInfos: ["getLocation"],
      })
    );
    await mkdir(path.join(dir, "pages", "index"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/index/index.js"),
      'wx.getLocation({ type: "wgs84" });\n'
    );

    const scanner = createPrivacyRule();
    const findings = await scanner.scan(dir);

    expect(findings).toHaveLength(0);

    await cleanup();
  });

  it("无 app.json 时不报错", async () => {
    const { dir, cleanup } = await tmpDir();

    const scanner = createPrivacyRule();
    const findings = await scanner.scan(dir);

    // 没有 app.json 可能意味着不是小程序项目，跳过不报错
    expect(Array.isArray(findings)).toBe(true);

    await cleanup();
  });
});
