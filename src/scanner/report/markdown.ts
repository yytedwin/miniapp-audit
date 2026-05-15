import type { Finding, ScanResult, Severity } from "../types";

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "阻塞上线",
  high: "高危",
  medium: "中危",
  low: "提醒",
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

function groupBySeverity(findings: Finding[]): Map<Severity, Finding[]> {
  const groups = new Map<Severity, Finding[]>();
  for (const severity of SEVERITY_ORDER) {
    groups.set(severity, []);
  }
  for (const finding of findings) {
    const group = groups.get(finding.severity);
    if (group) {
      group.push(finding);
    }
  }
  return groups;
}

function overallRisk(findings: Finding[]): string {
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  if (criticalCount > 0) return "不建议上线 (存在阻塞问题)";
  if (highCount > 3) return "建议整改后上线";
  if (highCount > 0) return "存在风险，建议检查后上线";
  return "可以上线";
}

function escapeMarkdown(text: string): string {
  return text.replace(/([*_`[\]()#+\-.!])/g, "\\$1");
}

export function generateMarkdown(result: ScanResult): string {
  const { projectPath, scannedAt, adapters, findings } = result;

  const lines: string[] = [];

  // Header
  lines.push("# 小程序上线前安全检查报告");
  lines.push("");
  lines.push(`- **项目路径**: ${escapeMarkdown(projectPath)}`);
  lines.push(`- **扫描时间**: ${scannedAt}`);
  lines.push(`- **扫描模块**: ${adapters.map((a) => a.adapterName).join(", ")}`);
  lines.push("");

  // Adapter status
  const failedAdapters = adapters.filter((a) => a.status !== "success");
  if (failedAdapters.length > 0) {
    lines.push("## 扫描状态");
    lines.push("");
    for (const adapter of failedAdapters) {
      lines.push(`- **${adapter.adapterName}**: 扫描失败 — ${adapter.error ?? "未知错误"}`);
    }
    lines.push("");
  }

  // Summary
  lines.push("## 扫描摘要");
  lines.push("");
  lines.push(`- **总发现问题**: ${findings.length}`);
  lines.push(`- **总体风险**: **${overallRisk(findings)}**`);
  lines.push("");

  // If no findings
  if (findings.length === 0) {
    lines.push("未发现安全问题。");
    return lines.join("\n");
  }

  // Grouped findings
  const grouped = groupBySeverity(findings);

  for (const severity of SEVERITY_ORDER) {
    const items = grouped.get(severity) ?? [];
    if (items.length === 0) continue;

    lines.push(`## ${SEVERITY_LABELS[severity]} (${items.length} 个问题)`);
    lines.push("");

    for (const finding of items) {
      lines.push(`### ${finding.title}`);
      lines.push("");
      lines.push(`- **严重等级**: ${SEVERITY_LABELS[finding.severity]}`);
      lines.push(`- **分类**: ${finding.category}`);
      lines.push(`- **来源**: ${finding.source}`);
      if (finding.filePath) {
        const location = finding.line
          ? `${finding.filePath}:${finding.line}`
          : finding.filePath;
        lines.push(`- **位置**: \`${escapeMarkdown(location)}\``);
      }
      lines.push("");

      if (finding.evidence) {
        lines.push("**证据**:");
        lines.push("");
        lines.push("```");
        lines.push(finding.evidence);
        lines.push("```");
        lines.push("");
      }

      lines.push(`**为什么重要**: ${finding.whyItMatters}`);
      lines.push("");
      lines.push(`**修复建议**: ${finding.recommendation}`);
      lines.push("");

      if (finding.references && finding.references.length > 0) {
        lines.push("**参考资料**:");
        for (const ref of finding.references) {
          lines.push(`- ${ref}`);
        }
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}
