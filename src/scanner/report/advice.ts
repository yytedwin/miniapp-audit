import type { Finding, ScanResult, Severity } from "../types";

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "阻塞上线",
  high: "高危",
  medium: "中危",
  low: "提醒",
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const CATEGORY_LABELS: Record<string, string> = {
  security: "安全",
  privacy: "隐私",
  compliance: "合规",
  payment: "支付",
  dependency: "依赖",
};

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  return findings.reduce<Record<Severity, number>>(
    (summary, finding) => {
      summary[finding.severity] += 1;
      return summary;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
}

function groupBySeverity(findings: Finding[]): Map<Severity, Finding[]> {
  const groups = new Map<Severity, Finding[]>();
  for (const severity of SEVERITY_ORDER) {
    groups.set(severity, []);
  }

  for (const finding of findings) {
    groups.get(finding.severity)?.push(finding);
  }

  return groups;
}

function getReleaseDecision(findings: Finding[]): string {
  const summary = countBySeverity(findings);

  if (summary.critical > 0) {
    return "不建议上线。存在阻塞上线问题，应先完成整改、复扫通过后再提交审核或发布。";
  }

  if (summary.high > 0) {
    return "建议整改后上线。高危问题可能影响审核、支付、隐私合规或线上安全。";
  }

  if (summary.medium > 0) {
    return "可在评估后上线。中危问题建议在本次发布前处理，至少要留下负责人和处理计划。";
  }

  if (summary.low > 0) {
    return "可上线，但建议把提醒项纳入后续优化。";
  }

  return "当前扫描未发现问题，可作为本次上线前检查留档。";
}

function escapeMarkdown(text: string): string {
  return text.replace(/([*_`[\]()#+\-.!|])/g, "\\$1");
}

function codeBlock(text: string): string[] {
  const longestTicks = Math.max(
    2,
    ...Array.from(text.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(longestTicks + 1);
  return [fence, text, fence];
}

function formatLocation(finding: Finding): string {
  if (!finding.filePath) return "未提供具体文件位置";
  if (!finding.line) return finding.filePath;
  return `${finding.filePath}:${finding.line}`;
}

function getPriorityGuidance(summary: Record<Severity, number>): string[] {
  const lines: string[] = [];

  if (summary.critical > 0) {
    lines.push(
      `1. 阻塞上线：先处理 ${summary.critical} 个 critical 问题，处理前不建议提交审核或发布。`,
    );
  }

  if (summary.high > 0) {
    lines.push(
      `${lines.length + 1}. 高危：处理 ${summary.high} 个 high 问题，重点关注隐私、支付、依赖漏洞和密钥泄露。`,
    );
  }

  if (summary.medium > 0) {
    lines.push(
      `${lines.length + 1}. 中危：确认影响范围，能在本次版本处理的应一并修复。`,
    );
  }

  if (summary.low > 0) {
    lines.push(
      `${lines.length + 1}. 提醒：整理到后续优化清单，避免长期积累成上线风险。`,
    );
  }

  if (lines.length === 0) {
    lines.push("1. 保留本次扫描结果，发布前如有代码变更需要重新扫描。");
  }

  return lines;
}

function formatDateForFileName(scannedAt: string): string {
  const date = new Date(scannedAt);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("sv-SE");
  }

  return date.toLocaleDateString("sv-SE");
}

export function createAdviceDocumentFileName(result: ScanResult): string {
  const projectName =
    result.projectPath
      .split(/[\\/]/)
      .filter(Boolean)
      .pop()
      ?.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "-") ?? "project";
  const date = formatDateForFileName(result.scannedAt);

  return `miniapp-audit-advice-${projectName}-${date}.md`;
}

export function generateAdviceDocument(result: ScanResult): string {
  const summary = countBySeverity(result.findings);
  const grouped = groupBySeverity(result.findings);
  const lines: string[] = [];

  lines.push("# 小程序上线问题整改建议书");
  lines.push("");
  lines.push(`- 项目路径：${escapeMarkdown(result.projectPath)}`);
  lines.push(`- 扫描时间：${result.scannedAt}`);
  lines.push(`- 问题总数：${result.findings.length}`);
  lines.push(
    `- 严重等级：阻塞上线 ${summary.critical} 个，高危 ${summary.high} 个，中危 ${summary.medium} 个，提醒 ${summary.low} 个`,
  );
  lines.push("");

  lines.push("## 上线判断");
  lines.push("");
  lines.push(getReleaseDecision(result.findings));
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("当前扫描未发现问题。可作为本次上线前检查留档。");
    lines.push("");
    lines.push("## 复查清单");
    lines.push("");
    lines.push("- [ ] 发布前确认代码、依赖、配置没有新增变更");
    lines.push("- [ ] 发布前重新运行一次扫描并保存报告");
    return lines.join("\n");
  }

  lines.push("## 优先整改顺序");
  lines.push("");
  lines.push(...getPriorityGuidance(summary));
  lines.push("");

  let index = 1;
  for (const severity of SEVERITY_ORDER) {
    const findings = grouped.get(severity) ?? [];
    if (findings.length === 0) continue;

    lines.push(`## ${SEVERITY_LABELS[severity]} (${findings.length} 个)`);
    lines.push("");

    for (const finding of findings) {
      lines.push(`### ${index}. ${finding.title}`);
      lines.push("");
      lines.push(`- 严重等级：${SEVERITY_LABELS[finding.severity]}`);
      lines.push(`- 分类：${CATEGORY_LABELS[finding.category] ?? finding.category}`);
      lines.push(`- 来源：${finding.source}`);
      lines.push(`- 位置：\`${formatLocation(finding)}\``);
      lines.push("");
      lines.push(`**风险说明**：${finding.whyItMatters}`);
      lines.push("");
      lines.push(`**整改建议**：${finding.recommendation}`);
      lines.push("");

      if (finding.evidence) {
        lines.push("**证据片段**：");
        lines.push("");
        lines.push(...codeBlock(finding.evidence));
        lines.push("");
      }

      if (finding.references?.length) {
        lines.push("**参考资料**：");
        for (const reference of finding.references) {
          lines.push(`- ${reference}`);
        }
        lines.push("");
      }

      lines.push("**建议验收方式**：");
      lines.push("- 复查上述文件或配置，确认风险点已经移除或改为安全实现。");
      lines.push("- 重新运行扫描，确认同类问题不再出现。");
      lines.push("");

      index += 1;
    }
  }

  lines.push("## 复查清单");
  lines.push("");
  lines.push("- [ ] 已重新运行扫描并确认阻塞上线问题为 0");
  lines.push("- [ ] 已确认高危问题完成整改，或有明确负责人、风险接受记录和补救计划");
  lines.push("- [ ] 已检查隐私政策、用户授权、支付回调、依赖漏洞和密钥配置");
  lines.push("- [ ] 已保存整改记录和复扫报告，用于上线审核或内部留档");

  return lines.join("\n");
}
