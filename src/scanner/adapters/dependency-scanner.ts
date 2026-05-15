import { readFile } from "fs/promises";
import { join } from "path";
import type { Finding, ScannerAdapter } from "../types";

type DepScannerOptions = {
  fetch?: typeof fetch;
};

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

type AdvisoryVersionInfo = {
  severity?: string;
  title?: string;
  recommendation?: string;
};

type NpmAdvisoryResponse = {
  vulnerable?: Record<string, Record<string, AdvisoryVersionInfo>>;
};

const NPM_ADVISORY_URL = "https://registry.npmjs.org/-/npm/v1/security/advisories";

export function createDependencyScanner(
  opts?: DepScannerOptions,
): ScannerAdapter {
  const fetchImpl = opts?.fetch ?? fetch;

  return {
    name: "dependency-scanner",
    isAvailable: () => true,

    async scan(projectPath: string): Promise<Finding[]> {
      const lockPath = join(projectPath, "package-lock.json");

      // Check if package-lock.json exists
      let lockData: PackageLock;
      try {
        const raw = await readFile(lockPath, "utf-8");
        lockData = JSON.parse(raw);
      } catch {
        // No lock file — not a JS project, skip
        return [];
      }

      // Extract package names and versions
      const packages: { name: string; version: string }[] = [];
      const pkgMap = lockData.packages ?? {};
      for (const [pkgPath, pkgInfo] of Object.entries(pkgMap)) {
        const name = pkgPath.replace("node_modules/", "");
        if (name && pkgInfo.version) {
          packages.push({ name, version: pkgInfo.version });
        }
      }

      if (packages.length === 0) return [];

      // Build query for npm advisory API
      const pkgNames = packages.map((p) => p.name);
      const query = pkgNames.join(",");

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        const res = await fetchImpl(`${NPM_ADVISORY_URL}?packages=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          // Rate limited or API error — degrade gracefully
          return [];
        }

        const advisoryData = (await res.json()) as NpmAdvisoryResponse;
        return extractVulnerabilityFindings(advisoryData, packages, lockPath);
      } catch {
        // Network error or timeout — degrade gracefully
        return [];
      }
    },
  };
}

function extractVulnerabilityFindings(
  advisoryData: NpmAdvisoryResponse,
  packages: { name: string; version: string }[],
  lockPath: string,
): Finding[] {
  const findings: Finding[] = [];
  const vulnerable = advisoryData.vulnerable ?? {};

  for (const pkg of packages) {
    const pkgAdvisories = vulnerable[pkg.name];
    if (!pkgAdvisories) continue;

    const versionInfo = pkgAdvisories[pkg.version];
    if (!versionInfo) continue;

    const severity = (versionInfo.severity as string)?.toLowerCase() ?? "medium";
    findings.push({
      id: `dep-${pkg.name}-${pkg.version}`,
      title: `${pkg.name}@${pkg.version} 存在已知安全漏洞`,
      severity: severity === "critical" ? "critical" : severity === "high" ? "high" : "medium",
      category: "dependency",
      filePath: lockPath,
      evidence: versionInfo.title ?? `${pkg.name} 存在高危漏洞`,
      whyItMatters: "依赖中的已知漏洞可能被攻击者利用",
      recommendation: versionInfo.recommendation ?? `升级 ${pkg.name} 到最新版本`,
      references: [`https://www.npmjs.com/advisories/${pkg.name}`],
      source: "dependency-scanner",
    });
  }

  return findings;
}
