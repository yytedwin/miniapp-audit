import { test, expect } from "@playwright/test";
import { resolve } from "path";

const FIXTURE_PATH = resolve(
  process.cwd(),
  "fixtures/vulnerable-miniapp",
);

test.describe("Web UI smoke tests", () => {
  test("首页能打开并显示标题", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("小程序上线前安全检查");
  });

  test("输入项目路径后开始扫描并进入报告页", async ({ page }) => {
    await page.goto("/");

    // Fill project path and start scan
    await page.fill("input", FIXTURE_PATH);
    await page.click("button:has-text('开始扫描')");

    // Should navigate to /scan and show scanning status
    await page.waitForURL(/\/scan\?/);

    // Wait for scan to complete and navigate to report
    await page.waitForURL(/\/report\//, { timeout: 15000 });

    // Report page should show risk assessment text
    await expect(page.locator("text=不建议上线")).toBeVisible({ timeout: 5000 });
  });

  test("报告页显示风险信息", async ({ page }) => {
    await page.goto("/");
    await page.fill("input", FIXTURE_PATH);
    await page.click("button:has-text('开始扫描')");
    await page.waitForURL(/\/report\//, { timeout: 15000 });

    // Overall risk assessment
    await expect(page.locator("text=不建议上线")).toBeVisible();

    // Severity category
    await expect(page.locator("text=阻塞上线")).toBeVisible();

    // At least one specific finding from the fixture
    const findingText = await page.textContent("body");
    const hasEnvFile =
      findingText!.includes(".env 文件被提交到仓库") ||
      findingText!.includes("API Key 明文硬编码");
    expect(hasEnvFile).toBe(true);

    // "总体风险" section label is visible
    await expect(page.locator("text=总体风险")).toBeVisible();
  });

  test("报告页可以下载问题整改建议文档", async ({ page }) => {
    await page.goto("/");
    await page.fill("input", FIXTURE_PATH);
    await page.click("button:has-text('开始扫描')");
    await page.waitForURL(/\/report\//, { timeout: 15000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载整改建议" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/miniapp-audit-advice-.*\.md/);
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();

    const chunks: Buffer[] = [];
    for await (const chunk of stream!) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString("utf8");

    expect(content).toContain("# 小程序上线问题整改建议书");
    expect(content).toContain("不建议上线");
    expect(content).toContain("复查清单");
  });

  test("访问 /history 能看到本次扫描记录", async ({ page }) => {
    await page.goto("/");
    await page.fill("input", FIXTURE_PATH);
    await page.click("button:has-text('开始扫描')");
    await page.waitForURL(/\/report\//, { timeout: 15000 });

    await page.goto("/history");

    // Page heading
    await expect(
      page.getByRole("heading", { name: "扫描历史" }),
    ).toBeVisible();

    // History contains the fixture project path
    await expect(
      page.locator("text=vulnerable-miniapp").first(),
    ).toBeVisible();

    // Risk badge should appear (fixture has critical findings)
    await expect(
      page.locator("text=不建议上线").first(),
    ).toBeVisible();
  });

  test("点击历史记录能回到对应报告页", async ({ page }) => {
    await page.goto("/");
    await page.fill("input", FIXTURE_PATH);
    await page.click("button:has-text('开始扫描')");
    await page.waitForURL(/\/report\//, { timeout: 15000 });

    await page.goto("/history");

    // Click the row containing the fixture project name (whole row = user behavior)
    const row = page
      .getByTestId("history-row")
      .filter({ hasText: "vulnerable-miniapp" })
      .first();
    await expect(row).toBeVisible({ timeout: 5000 });
    await row.click();
    await page.waitForURL(/\/report\//, { timeout: 5000 });
  });

  test("空历史页显示引导文案", async ({ page }) => {
    // Clear localStorage to simulate fresh state
    await page.goto("/history");
    await page.evaluate(() => localStorage.clear());

    await page.reload();
    await expect(page.locator("text=暂无扫描记录")).toBeVisible();
    await expect(page.locator("text=开始首次扫描")).toBeVisible();
  });
});
