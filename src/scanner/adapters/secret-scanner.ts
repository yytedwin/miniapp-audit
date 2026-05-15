import { readFile, readdir, stat } from "fs/promises";
import { join, extname } from "path";
import type { Finding, ScannerAdapter, ScanOptions } from "../types";

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot",
  ".mp3", ".mp4", ".avi", ".mov",
  ".zip", ".tar", ".gz", ".bz2",
  ".bin", ".exe", ".dll",
]);

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Pattern: matches common secret/key patterns
const SECRET_PATTERNS: { pattern: RegExp; title: string }[] = [
  {
    pattern: /(?:API[_-]?KEY|api[_-]?key|apiKey)\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}["']?/g,
    title: "API Key 明文硬编码",
  },
  {
    pattern: /JWT[_-]?SECRET\s*[:=]\s*["']?[A-Za-z0-9_\-]{10,}["']?/gi,
    title: "JWT Secret 明文硬编码",
  },
  {
    pattern: /(?:DB[_-]?(?:URL|PASSWORD|PASS)|DATABASE_URL)\s*[:=]\s*["']?[^"'\n]{10,}["']?/gi,
    title: "数据库连接信息明文硬编码",
  },
  {
    pattern: /(?:SecretId|SECRET_ID|secretId)\s*[:=]\s*["']?[A-Za-z0-9]{20,}["']?/g,
    title: "腾讯云 SecretId 明文硬编码",
  },
  {
    pattern: /(?:SecretKey|SECRET_KEY|secretKey)\s*[:=]\s*["']?[A-Za-z0-9]{20,}["']?/g,
    title: "云服务 SecretKey 明文硬编码",
  },
  {
    pattern: /(?:AccessKey|ACCESS_KEY|accessKey)(?:Id|Secret)?\s*[:=]\s*["']?[A-Za-z0-9]{16,}["']?/g,
    title: "云服务 AccessKey 明文硬编码",
  },
];

const SENSITIVE_FILE_PATTERNS: { pattern: RegExp; title: string }[] = [
  { pattern: /^\.env$/i, title: ".env 文件被提交到仓库" },
  { pattern: /\.pem$/i, title: "PEM 私钥文件被提交" },
  { pattern: /\.p12$/i, title: "PKCS12 证书文件被提交" },
  { pattern: /credentials\.json$/i, title: "云服务凭证文件被提交" },
  { pattern: /\.npmrc$/i, title: ".npmrc (可能含 auth token) 被提交" },
];

function isBinaryFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

async function* walkFiles(
  dir: string,
  exclude: string[] = [],
): AsyncGenerator<string> {
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

      // Skip hidden items (except .env file)
      if (entry.name.startsWith(".")) {
        if (entry.name === ".env" && !entry.isDirectory()) {
          yield fullPath;
        }
        continue;
      }

      // Skip excluded directories/files
      if (exclude.includes(entry.name)) continue;
      if (entry.name === "node_modules") continue;

      if (entry.isDirectory()) {
        stack.push({ path: fullPath, depth: current.depth + 1 });
      } else {
        yield fullPath;
      }
    }
  }
}

function extractFindings(
  content: string,
  filePath: string,
  patterns: typeof SECRET_PATTERNS,
): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (const { pattern, title } of patterns) {
    let match: RegExpExecArray | null;
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const patternCopy = new RegExp(pattern.source, flags);
    while ((match = patternCopy.exec(content)) !== null) {
      const lineIndex = lines.findIndex((l) => l.includes(match![0]));
      findings.push({
        id: `secret-${findings.length}-${match[0].slice(0, 8)}`,
        title,
        severity: "critical",
        category: "security",
        filePath,
        line: lineIndex >= 0 ? lineIndex + 1 : undefined,
        evidence: match[0].slice(0, 100),
        whyItMatters: "密钥泄露可导致数据被盗、服务被恶意使用、产生高额账单",
        recommendation: "将密钥移至环境变量 (.env.local) 中，并确保 .env 已在 .gitignore 中",
        source: "secret-scanner",
      });
    }
  }
  return findings;
}

export function createSecretScanner(): ScannerAdapter {
  return {
    name: "secret-scanner",
    isAvailable: () => true,
    async scan(projectPath: string, options?: ScanOptions): Promise<Finding[]> {
      const maxSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
      const findings: Finding[] = [];

      for await (const filePath of walkFiles(projectPath, options?.exclude)) {
        // Check for sensitive file names
        const fileName = filePath.split("/").pop() ?? "";
        for (const { pattern, title } of SENSITIVE_FILE_PATTERNS) {
          if (pattern.test(fileName)) {
            findings.push({
              id: `secret-file-${findings.length}`,
              title,
              severity: "critical",
              category: "security",
              filePath,
              whyItMatters: "敏感配置文件提交到仓库可导致密钥泄露",
              recommendation: "将此文件加入 .gitignore",
              source: "secret-scanner",
            });
          }
        }

        // Skip binary files
        if (isBinaryFile(filePath)) continue;

        // Check file size
        try {
          const fileStat = await stat(filePath);
          if (fileStat.size > maxSize) continue;
        } catch {
          continue;
        }

        // Read and scan text files
        try {
          const content = await readFile(filePath, "utf-8");
          const fileFindings = extractFindings(content, filePath, SECRET_PATTERNS);
          findings.push(...fileFindings);
        } catch {
          // Binary or unreadable file
        }
      }

      return findings;
    },
  };
}
