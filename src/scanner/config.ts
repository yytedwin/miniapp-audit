import { readFile } from "fs/promises";
import { join } from "path";

export interface AuditConfig {
  rules: Record<string, { enabled: boolean }>;
  exclude: string[];
}

const DEFAULT_CONFIG: AuditConfig = {
  rules: {},
  exclude: ["node_modules", ".git", "dist"],
};

export async function loadConfig(projectPath: string): Promise<AuditConfig> {
  const configPath = join(projectPath, "miniapp-audit.config.json");

  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch {
    return { ...DEFAULT_CONFIG, rules: {} };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `配置文件 JSON 格式错误: ${configPath}\n${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    rules: (parsed.rules as AuditConfig["rules"]) ?? {},
    exclude: Array.isArray(parsed.exclude)
      ? (parsed.exclude as string[])
      : DEFAULT_CONFIG.exclude,
  };
}
