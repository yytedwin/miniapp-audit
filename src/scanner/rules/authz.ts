import { readFile } from "fs/promises";
import { basename } from "path";
import type { Finding, ScannerAdapter, ScanOptions } from "../types";

async function* walkJSFiles(
  dir: string,
  exclude: string[] = [],
): AsyncGenerator<string> {
  const { readdir } = await import("fs/promises");
  const { join } = await import("path");
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

const AUTHZ_RULES = [
  {
    name: "no-auth-middleware",
    check: (content: string): boolean => {
      const hasApiHandler = /exports\.(handler|get|post|put|delete)\s*[=(]|export.*function.*\(req.*res\)|async.*\(req.*res\)/.test(content);
      const hasAuth = /auth|authenticate|authorize|middleware|鉴权|认证|session|token|jwt|getCurrentUser/.test(content);
      return hasApiHandler && !hasAuth;
    },
    title: "API 接口无鉴权",
    severity: "critical" as const,
    whyItMatters: "无鉴权的接口可被任何人访问，可能导致数据泄露",
    recommendation: "添加鉴权中间件，验证请求中的 token 或 session",
  },
  {
    name: "hardcoded-admin",
    check: (content: string): boolean => {
      const hasAdminConfig = /admin|管理员|superadmin|root.*user/.test(content);
      const hasHardcodedPassword = /password\s*[:=]\s*["'][^"'\n]{4,}["']/.test(content);
      return hasAdminConfig && hasHardcodedPassword;
    },
    title: "管理员账号硬编码",
    severity: "high" as const,
    whyItMatters: "硬编码的管理员凭证泄露后无法快速轮换，且可能在 git 历史中永久留存",
    recommendation: "管理员账号通过环境变量配置初始密码，首次登录后强制修改",
  },
  {
    name: "idor-query",
    check: (content: string): boolean => {
      const hasDbQuery = /db\.(query|find|get|select)|SELECT.*FROM.*WHERE|\.collection\(["'][^"']+["']\)\.doc\([^)]*(?:id|Id|ID)[^)]*\)\.get\(/.test(content);
      const hasUserScoping = /userId|user_id|currentUser|session\.user|req\.user|current_user/.test(content);
      return hasDbQuery && !hasUserScoping;
    },
    title: "数据查询无用户归属校验 (潜在 IDOR)",
    severity: "high" as const,
    whyItMatters: "攻击者可以通过修改 ID 参数访问其他用户的数据",
    recommendation: "在查询条件中添加用户 ID 过滤: WHERE user_id = ?",
  },
];

export function createAuthzRule(): ScannerAdapter {
  return {
    name: "authz-rule",
    isAvailable: () => true,

    async scan(projectPath: string, options?: ScanOptions): Promise<Finding[]> {
      const findings: Finding[] = [];

      for await (const filePath of walkJSFiles(projectPath, options?.exclude)) {
        let content: string;
        try {
          content = await readFile(filePath, "utf-8");
        } catch {
          continue;
        }

        for (const rule of AUTHZ_RULES) {
          if (rule.check(content)) {
            const lines = content.split("\n");
            const relevantLine = lines.find(
              (l) => /export|function|handler|password|admin|query|SELECT/.test(l)
            );
            const lineIndex = relevantLine ? lines.indexOf(relevantLine) : -1;

            findings.push({
              id: `authz-${rule.name}-${basename(filePath)}`,
              title: rule.title,
              severity: rule.severity,
              category: "security",
              filePath,
              line: lineIndex >= 0 ? lineIndex + 1 : undefined,
              evidence: relevantLine?.trim().slice(0, 100),
              whyItMatters: rule.whyItMatters,
              recommendation: rule.recommendation,
              source: "authz-rule",
            });
          }
        }
      }

      return findings;
    },
  };
}
