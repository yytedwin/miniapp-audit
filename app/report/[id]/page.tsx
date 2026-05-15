"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Finding, ScanResult, Severity } from "@/src/scanner/types";
import {
  createAdviceDocumentFileName,
  generateAdviceDocument,
} from "@/src/scanner/report/advice";
import { getReportResult } from "@/src/scanner/history";

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: "阻塞上线", color: "var(--critical)", bg: "var(--critical-bg)" },
  high: { label: "高危", color: "var(--high)", bg: "var(--high-bg)" },
  medium: { label: "中危", color: "var(--medium)", bg: "var(--medium-bg)" },
  low: { label: "提醒", color: "var(--low)", bg: "var(--low-bg)" },
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

const CATEGORY_LABELS: Record<string, string> = {
  security: "安全",
  privacy: "隐私",
  compliance: "合规",
  payment: "支付",
  dependency: "依赖",
};

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  useEffect(() => {
    // Try sessionStorage first (current session), then localStorage (history)
    const data = sessionStorage.getItem(`report-${params.id}`);
    if (data) {
      setResult(JSON.parse(data));
      return;
    }

    const stored = getReportResult(params.id);
    if (stored) {
      setResult(stored);
      return;
    }

    router.push("/");
  }, [params.id, router]);

  const grouped = useMemo(() => {
    if (!result) return new Map<Severity, Finding[]>();
    const g = new Map<Severity, Finding[]>();
    for (const s of SEVERITY_ORDER) g.set(s, []);
    for (const f of result.findings) {
      g.get(f.severity)?.push(f);
    }
    return g;
  }, [result]);

  const criticalCount = grouped.get("critical")?.length ?? 0;
  const highCount = grouped.get("high")?.length ?? 0;

  const overallRisk = useMemo(() => {
    if (criticalCount > 0) return { label: "不建议上线", color: "var(--critical)" };
    if (highCount > 3) return { label: "建议整改后上线", color: "var(--high)" };
    if (highCount > 0) return { label: "存在风险", color: "var(--high)" };
    return { label: "可以上线", color: "var(--success)" };
  }, [criticalCount, highCount]);

  const downloadAdvice = useCallback(() => {
    if (!result) return;

    const documentText = generateAdviceDocument(result);
    const blob = new Blob([documentText], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = createAdviceDocumentFileName(result);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [result]);

  if (!result) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <Link href="/" style={styles.logo}>
          <span style={styles.logoIcon}>&#9675;</span>
          <span style={styles.logoText}>AUDIT</span>
        </Link>
        <span style={styles.headerRight}>
          扫描时间: {new Date(result.scannedAt).toLocaleString("zh-CN")}
        </span>
      </header>

      {/* Summary bar */}
      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>项目</span>
          <code style={styles.summaryPath}>{result.projectPath}</code>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>发现问题</span>
          <span style={styles.summaryCount}>{result.findings.length}</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>总体风险</span>
          <span style={{ ...styles.riskBadge, color: overallRisk.color }}>
            {overallRisk.label}
          </span>
        </div>
        <div style={styles.summaryActions}>
          {result.findings.length > 0 && (
            <button
              type="button"
              onClick={downloadAdvice}
              style={styles.downloadAdviceBtn}
            >
              下载整改建议
            </button>
          )}
          <Link href="/" style={styles.newScanBtn}>新扫描</Link>
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={styles.panels}>
        {/* Left: finding list */}
        <div style={styles.leftPanel}>
          {SEVERITY_ORDER.map((severity) => {
            const items = grouped.get(severity) ?? [];
            if (items.length === 0) return null;
            const config = SEVERITY_CONFIG[severity];
            return (
              <div key={severity} style={styles.severityGroup}>
                <div style={{ ...styles.severityHeader, background: config.bg }}>
                  <span style={{ ...styles.severityDot, background: config.color }} />
                  <span style={styles.severityLabel}>{config.label}</span>
                  <span style={styles.severityCount}>{items.length} 个问题</span>
                </div>
                {items.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFinding(f)}
                    style={{
                      ...styles.findingItem,
                      ...(selectedFinding?.id === f.id ? styles.findingItemActive : {}),
                    }}
                  >
                    <span
                      style={{
                        ...styles.findingSeverityDot,
                        background: config.color,
                      }}
                    />
                    <span style={styles.findingTitle}>{f.title}</span>
                    <span style={styles.findingCat}>
                      {CATEGORY_LABELS[f.category] ?? f.category}
                    </span>
                    <span style={styles.findingLocation}>
                      {f.filePath
                        ? f.line
                          ? `${f.filePath.split("/").pop()}:${f.line}`
                          : f.filePath.split("/").pop()
                        : "—"}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}

          {result.findings.length === 0 && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>&#10003;</span>
              <p style={styles.emptyTitle}>未发现问题</p>
              <p style={styles.emptyDesc}>该项目通过所有安全检查</p>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div style={styles.rightPanel}>
          {selectedFinding ? (
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <span
                  style={{
                    ...styles.detailSeverityBadge,
                    background: SEVERITY_CONFIG[selectedFinding.severity].bg,
                    color: SEVERITY_CONFIG[selectedFinding.severity].color,
                  }}
                >
                  {SEVERITY_CONFIG[selectedFinding.severity].label}
                </span>
                <span style={styles.detailCategory}>
                  {CATEGORY_LABELS[selectedFinding.category] ?? selectedFinding.category}
                </span>
                <span style={styles.detailSource}>{selectedFinding.source}</span>
              </div>

              <h2 style={styles.detailTitle}>{selectedFinding.title}</h2>

              {selectedFinding.filePath && (
                <div style={styles.detailLocation}>
                  <code>
                    {selectedFinding.filePath}
                    {selectedFinding.line ? `:${selectedFinding.line}` : ""}
                  </code>
                </div>
              )}

              {selectedFinding.evidence && (
                <div style={styles.detailSection}>
                  <h3 style={styles.detailSectionTitle}>证据</h3>
                  <pre style={styles.detailCode}>{selectedFinding.evidence}</pre>
                </div>
              )}

              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>为什么重要</h3>
                <p style={styles.detailText}>{selectedFinding.whyItMatters}</p>
              </div>

              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>修复建议</h3>
                <p style={styles.detailText}>{selectedFinding.recommendation}</p>
              </div>

              {selectedFinding.references && selectedFinding.references.length > 0 && (
                <div style={styles.detailSection}>
                  <h3 style={styles.detailSectionTitle}>参考资料</h3>
                  {selectedFinding.references.map((ref) => (
                    <a key={ref} href={ref} target="_blank" style={styles.referenceLink}>
                      {ref}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.detailEmpty}>
              <span style={styles.detailEmptyIcon}>&#8592;</span>
              <p>选择一个问题查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "var(--bg-primary)",
    display: "flex",
    flexDirection: "column",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    color: "var(--text-secondary)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    fontSize: "14px",
    letterSpacing: "4px",
    color: "var(--text-primary)",
    textDecoration: "none",
  },
  logoIcon: { color: "var(--accent)", fontSize: "10px" },
  logoText: { color: "var(--text-secondary)" },
  headerRight: { fontSize: "13px", color: "var(--text-muted)" },
  summaryBar: {
    display: "flex",
    alignItems: "center",
    gap: "32px",
    padding: "16px 24px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  summaryItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  summaryLabel: { fontSize: "13px", color: "var(--text-muted)" },
  summaryPath: {
    fontSize: "13px",
    color: "var(--text-primary)",
    maxWidth: "200px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  summaryCount: { fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" },
  riskBadge: {
    fontSize: "14px",
    fontWeight: 600,
    padding: "4px 12px",
    borderRadius: "var(--radius)",
  },
  summaryActions: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  downloadAdviceBtn: {
    fontSize: "13px",
    color: "var(--bg-primary)",
    background: "var(--accent)",
    padding: "7px 16px",
    border: "1px solid var(--accent)",
    borderRadius: "var(--radius)",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  newScanBtn: {
    fontSize: "13px",
    color: "var(--accent)",
    textDecoration: "none",
    padding: "6px 16px",
    border: "1px solid var(--accent)",
    borderRadius: "var(--radius)",
  },
  panels: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  leftPanel: {
    width: "45%",
    minWidth: "380px",
    borderRight: "1px solid var(--border)",
    overflowY: "auto",
    padding: "16px",
  },
  severityGroup: {
    marginBottom: "16px",
  },
  severityHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "var(--radius)",
    marginBottom: "4px",
  },
  severityDot: { width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0 },
  severityLabel: { fontSize: "13px", fontWeight: 600 },
  severityCount: { fontSize: "12px", color: "var(--text-secondary)", marginLeft: "auto" },
  findingItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    padding: "10px 12px",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "var(--radius)",
    cursor: "pointer",
    textAlign: "left",
    color: "var(--text-primary)",
    fontFamily: "inherit",
    fontSize: "13px",
  },
  findingItemActive: {
    background: "var(--bg-input)",
    border: "1px solid var(--border-active)",
  },
  findingSeverityDot: { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0 },
  findingTitle: { flex: 1 },
  findingCat: { color: "var(--text-muted)", fontSize: "12px" },
  findingLocation: {
    color: "var(--text-muted)",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
  },
  emptyState: {
    textAlign: "center",
    padding: "64px 24px",
  },
  emptyIcon: { fontSize: "48px", color: "var(--success)" },
  emptyTitle: { fontSize: "18px", fontWeight: 600, marginTop: "16px" },
  emptyDesc: { fontSize: "14px", color: "var(--text-secondary)", marginTop: "8px" },
  rightPanel: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
  },
  detailCard: {
    maxWidth: "640px",
  },
  detailHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  detailSeverityBadge: {
    fontSize: "12px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "var(--radius)",
  },
  detailCategory: {
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
  detailSource: {
    fontSize: "12px",
    color: "var(--text-muted)",
    marginLeft: "auto",
  },
  detailTitle: { fontSize: "20px", fontWeight: 600, marginBottom: "8px" },
  detailLocation: {
    padding: "10px 14px",
    background: "var(--bg-input)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    marginBottom: "24px",
    fontSize: "13px",
  },
  detailSection: { marginBottom: "24px" },
  detailSectionTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  detailText: { fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.7 },
  detailCode: {
    fontSize: "13px",
  },
  referenceLink: {
    display: "block",
    fontSize: "13px",
    color: "var(--accent)",
    marginBottom: "4px",
  },
  detailEmpty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "var(--text-muted)",
    gap: "12px",
  },
  detailEmptyIcon: { fontSize: "32px" },
};
