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
    if (group) group.push(finding);
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFinding(finding: Finding): string {
  let html = `<div class="finding">`;
  html += `<h3>${escapeHtml(finding.title)}</h3>`;
  html += `<div class="meta">`;
  html += `<span class="severity severity-${finding.severity}">${SEVERITY_LABELS[finding.severity]}</span>`;
  html += `<span class="category">${escapeHtml(finding.category)}</span>`;
  html += `<span class="source">${escapeHtml(finding.source)}</span>`;
  html += `</div>`;

  if (finding.filePath) {
    const location = finding.line
      ? `${finding.filePath}:${finding.line}`
      : finding.filePath;
    html += `<p class="location">位置: ${escapeHtml(location)}</p>`;
  }

  if (finding.evidence) {
    html += `<pre class="evidence">${escapeHtml(finding.evidence)}</pre>`;
  }

  html += `<p class="why"><strong>为什么重要:</strong> ${escapeHtml(finding.whyItMatters)}</p>`;
  html += `<p class="recommendation"><strong>修复建议:</strong> ${escapeHtml(finding.recommendation)}</p>`;

  if (finding.references && finding.references.length > 0) {
    html += `<p class="references"><strong>参考资料:</strong></p><ul>`;
    for (const ref of finding.references) {
      html += `<li>${escapeHtml(ref)}</li>`;
    }
    html += `</ul>`;
  }

  html += `</div>`;
  return html;
}

export function generateHtml(result: ScanResult): string {
  const { projectPath, scannedAt, adapters, findings } = result;

  let body = "";

  // Header
  body += `<header>`;
  body += `<h1>小程序上线前安全检查报告</h1>`;
  body += `<p>项目路径: ${escapeHtml(projectPath)}</p>`;
  body += `<p>扫描时间: ${escapeHtml(scannedAt)}</p>`;
  body += `</header>`;

  // Adapter status
  const failedAdapters = adapters.filter((a) => a.status !== "success");
  if (failedAdapters.length > 0) {
    body += `<section class="adapter-status">`;
    body += `<h2>扫描状态</h2>`;
    for (const adapter of failedAdapters) {
      body += `<p>${escapeHtml(adapter.adapterName)}: 扫描失败 — ${escapeHtml(adapter.error ?? "未知错误")}</p>`;
    }
    body += `</section>`;
  }

  // Summary
  body += `<section class="summary">`;
  body += `<h2>扫描摘要</h2>`;
  body += `<p>总发现问题: ${findings.length}</p>`;
  body += `<p>总体风险: <strong>${overallRisk(findings)}</strong></p>`;
  body += `</section>`;

  // Findings
  if (findings.length === 0) {
    body += `<section class="clean"><p>未发现安全问题。</p></section>`;
  } else {
    const grouped = groupBySeverity(findings);
    for (const severity of SEVERITY_ORDER) {
      const items = grouped.get(severity) ?? [];
      if (items.length === 0) continue;
      body += `<section class="severity-group">`;
      body += `<h2>${SEVERITY_LABELS[severity]} (${items.length} 个问题)</h2>`;
      for (const finding of items) {
        body += renderFinding(finding);
      }
      body += `</section>`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>小程序上线前安全检查报告</title>
<style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --text: #c9d1d9;
    --muted: #8b949e;
    --critical: #ff7b72;
    --high: #ffa657;
    --medium: #d29922;
    --low: #7ee787;
    --accent: #58a6ff;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 2rem;
    max-width: 960px;
    margin: 0 auto;
  }
  header { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
  header h1 { font-size: 1.75rem; color: var(--accent); margin-bottom: 0.5rem; }
  header p { color: var(--muted); font-size: 0.875rem; }
  h2 { font-size: 1.25rem; margin: 1.5rem 0 1rem; color: var(--text); }
  section { margin-bottom: 1.5rem; }
  .summary { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; }
  .summary p { margin: 0.25rem 0; }
  .adapter-status { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; }
  .adapter-status p { color: var(--high); }
  .severity-group { margin-bottom: 1.5rem; }
  .finding {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 0.75rem;
  }
  .finding h3 { font-size: 1rem; margin-bottom: 0.5rem; }
  .meta { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .severity {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
    text-transform: uppercase;
  }
  .severity-critical { background: rgba(255,123,114,0.15); color: var(--critical); }
  .severity-high { background: rgba(255,166,87,0.15); color: var(--high); }
  .severity-medium { background: rgba(210,153,34,0.15); color: var(--medium); }
  .severity-low { background: rgba(126,231,135,0.15); color: var(--low); }
  .category, .source { font-size: 0.75rem; color: var(--muted); }
  .location { font-size: 0.875rem; color: var(--muted); margin-bottom: 0.5rem; }
  .evidence {
    background: #0d1117;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.75rem;
    margin: 0.5rem 0;
    font-size: 0.8125rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .why, .recommendation { font-size: 0.875rem; margin: 0.25rem 0; }
  .references { font-size: 0.875rem; margin-top: 0.5rem; }
  .references + ul { font-size: 0.875rem; color: var(--muted); padding-left: 1.5rem; }
  .clean { text-align: center; padding: 3rem 1rem; color: var(--low); }
  .summary strong { color: var(--text); }
  @media print {
    body { background: white; color: black; }
    .finding { border: 1px solid #ccc; break-inside: avoid; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;

  return html;
}
