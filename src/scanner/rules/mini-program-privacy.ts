import { readFile } from "fs/promises";
import { join, basename } from "path";
import type { Finding, ScannerAdapter, ScanOptions } from "../types";

type MiniProgramAppJson = {
  requiredPrivateInfos?: string[];
};

// Privacy APIs that require declaration in app.json
const PRIVACY_APIS = [
  { api: "getLocation", title: "getLocation 需要位置隐私声明", description: "获取用户位置" },
  { api: "getUserProfile", title: "getUserProfile 需要用户信息隐私声明", description: "获取用户信息" },
  { api: "chooseAddress", title: "chooseAddress 需要通讯地址隐私声明", description: "获取用户通讯地址" },
  { api: "chooseInvoiceTitle", title: "chooseInvoiceTitle 需要发票信息隐私声明", description: "获取用户发票信息" },
  { api: "getWeRunData", title: "getWeRunData 需要微信运动隐私声明", description: "获取微信运动数据" },
  { api: "startRecord", title: "startRecord 需要麦克风隐私声明", description: "使用麦克风" },
  { api: "chooseImage", title: "chooseImage 需要相册隐私声明", description: "访问用户相册" },
  { api: "saveImageToPhotosAlbum", title: "saveImageToPhotosAlbum 需要相册写入隐私声明", description: "写入相册" },
];

async function* walkJSFiles(
  dir: string,
  exclude: string[] = [],
): AsyncGenerator<string> {
  const { readdir } = await import("fs/promises");
  const MAX_DEPTH = 50;
  const stack: { path: string; depth: number }[] = [{ path: dir, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.depth > MAX_DEPTH) continue;

    let entries;
    try {
      entries = await readdir(current.path, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(current.path, entry.name);
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      if (exclude.includes(entry.name)) continue;

      if (entry.isDirectory()) {
        stack.push({ path: fullPath, depth: current.depth + 1 });
      } else if (/\.(js|ts|jsx|tsx)$/.test(entry.name)) {
        yield fullPath;
      }
    }
  }
}

export function createPrivacyRule(): ScannerAdapter {
  return {
    name: "privacy-rule",
    isAvailable: () => true,

    async scan(projectPath: string, options?: ScanOptions): Promise<Finding[]> {
      const findings: Finding[] = [];

      // Read app.json to check requiredPrivateInfos
      let appJson: MiniProgramAppJson | null = null;
      try {
        const appJsonPath = join(projectPath, "app.json");
        const raw = await readFile(appJsonPath, "utf-8");
        appJson = JSON.parse(raw);
      } catch {
        // No app.json — likely not a mini program project, skip
      }

      const declaredPrivacies: string[] = appJson?.requiredPrivateInfos ?? [];

      // Scan all JS/TS files for privacy API usage
      for await (const filePath of walkJSFiles(projectPath, options?.exclude)) {
        let content: string;
        try {
          content = await readFile(filePath, "utf-8");
        } catch {
          continue;
        }

        for (const { api, title, description } of PRIVACY_APIS) {
          if (content.includes(`wx.${api}`) || content.includes(`wx.${api}(`)) {
            if (!declaredPrivacies.includes(api)) {
              const lines = content.split("\n");
              const lineIndex = lines.findIndex((l) => l.includes(api));

              findings.push({
                id: `privacy-${api}-${basename(filePath)}`,
                title,
                severity: "critical",
                category: "privacy",
                filePath,
                line: lineIndex >= 0 ? lineIndex + 1 : undefined,
                evidence: lines[lineIndex]?.trim().slice(0, 100),
                whyItMatters: `代码中使用 ${api}(${description}) 但未在 app.json 的 requiredPrivateInfos 中声明，微信审核将被拒绝`,
                recommendation: `在 app.json 的 requiredPrivateInfos 中添加 "${api}"`,
                source: "privacy-rule",
              });
            }
          }
        }
      }

      return findings;
    },
  };
}
