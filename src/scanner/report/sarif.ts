import type { ScanResult, Severity, Finding } from "../types";

const SARIF_SCHEMA =
  "https://docs.oasis-open.org/sarif/sarif/v2.1.0/csd01/schemas/sarif-schema-2.1.0.json";

const SEVERITY_TO_LEVEL: Record<Severity, string> = {
  critical: "error",
  high: "warning",
  medium: "warning",
  low: "note",
};

function relativePath(projectPath: string, filePath: string): string {
  const normalizedProject = projectPath.endsWith("/")
    ? projectPath
    : projectPath + "/";
  if (filePath.startsWith(normalizedProject)) {
    return filePath.slice(normalizedProject.length);
  }
  return filePath;
}

function toSarifResult(projectPath: string, finding: Finding) {
  const result: Record<string, unknown> = {
    ruleId: finding.category,
    level: SEVERITY_TO_LEVEL[finding.severity],
    message: {
      text: `${finding.title}\n\n${finding.whyItMatters}\n\n修复建议: ${finding.recommendation}`,
    },
  };

  if (finding.filePath) {
    result.locations = [
      {
        physicalLocation: {
          artifactLocation: {
            uri: relativePath(projectPath, finding.filePath),
          },
          region: {
            startLine: finding.line ?? 1,
          },
        },
      },
    ];
  }

  return result;
}

export function generateSarif(result: ScanResult): string {
  const sarifLog = {
    $schema: SARIF_SCHEMA,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "miniapp-audit",
            informationUri: "https://github.com/user/miniapp-audit",
          },
        },
        invocations: [
          {
            executionSuccessful: true,
            startTimeUtc: result.scannedAt,
            endTimeUtc: new Date().toISOString(),
          },
        ],
        results: result.findings.map((f) => toSarifResult(result.projectPath, f)),
      },
    ],
  };

  return JSON.stringify(sarifLog, null, 2);
}
