import { resolve } from "path";
import { stat } from "fs/promises";
import type { ScanResult, ScannerAdapter, ScanOptions } from "./types";
import { dedup } from "./dedup";
import { createSecretScanner } from "./adapters/secret-scanner";
import { createDependencyScanner } from "./adapters/dependency-scanner";
import { createPrivacyRule } from "./rules/mini-program-privacy";
import { createPaymentRule } from "./rules/payment-callback";
import { createAuthzRule } from "./rules/authz";
import { loadConfig } from "./config";
import type { AuditConfig } from "./config";

async function validatePath(projectPath: string): Promise<string> {
  const resolved = resolve(projectPath);

  let fileStat;
  try {
    fileStat = await stat(resolved);
  } catch {
    throw new PathNotFoundError(projectPath);
  }

  if (!fileStat.isDirectory()) {
    throw new NotDirectoryError(projectPath);
  }

  // Prevent path traversal: the resolved path must be a subdirectory
  // or the same as the original path
  if (resolved !== projectPath && !resolved.startsWith(resolve(projectPath))) {
    throw new PathTraversalError(projectPath);
  }

  return resolved;
}

export class PathNotFoundError extends Error {
  constructor(path: string) {
    super(`路径不存在: ${path}`);
    this.name = "PathNotFoundError";
  }
}

export class NotDirectoryError extends Error {
  constructor(path: string) {
    super(`路径不是目录: ${path}`);
    this.name = "NotDirectoryError";
  }
}

export class PathTraversalError extends Error {
  constructor(path: string) {
    super(`路径遍历检测: ${path}`);
    this.name = "PathTraversalError";
  }
}

export async function scanProject(
  projectPath: string,
  options?: ScanOptions,
): Promise<ScanResult> {
  const resolvedPath = await validatePath(projectPath);

  // Load config: use provided config or load from project
  const config: AuditConfig =
    options?.config ?? (await loadConfig(resolvedPath));

  const allAdapters: ScannerAdapter[] = [
    createSecretScanner(),
    createDependencyScanner(),
    createPrivacyRule(),
    createPaymentRule(),
    createAuthzRule(),
  ];

  // Filter adapters based on config rules
  const adapters = allAdapters.filter((adapter) => {
    const rule = config.rules[adapter.name];
    if (rule && rule.enabled === false) return false;
    return true;
  });

  // Pass exclude paths to scanner options
  const scanOpts: ScanOptions = {
    maxFileSize: options?.maxFileSize,
    exclude: config.exclude,
  };

  const adapterResults = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        const findings = await adapter.scan(resolvedPath, scanOpts);
        return {
          adapterName: adapter.name,
          status: "success" as const,
          findings,
        };
      } catch (error) {
        return {
          adapterName: adapter.name,
          status: "failed" as const,
          findings: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const allFindings = adapterResults.flatMap((r) => r.findings);
  const dedupedFindings = dedup(allFindings);

  return {
    projectPath: resolvedPath,
    scannedAt: new Date().toISOString(),
    adapters: adapterResults,
    findings: dedupedFindings,
  };
}
