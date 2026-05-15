"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getHistory,
  deleteRecord,
  type ScanRecord,
} from "@/src/scanner/history";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--critical)",
  high: "var(--high)",
  medium: "var(--medium)",
  low: "var(--low)",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "var(--critical-bg)",
  high: "var(--high-bg)",
  medium: "var(--medium-bg)",
  low: "var(--low-bg)",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "阻塞",
  high: "高危",
  medium: "中危",
  low: "提醒",
};

function riskBadge(record: ScanRecord) {
  if (record.summary.critical > 0) return { text: "不建议上线", color: "var(--critical)" };
  if (record.summary.high > 3) return { text: "建议整改", color: "var(--high)" };
  if (record.summary.high > 0) return { text: "存在风险", color: "var(--medium)" };
  return { text: "可以上线", color: "var(--success)" };
}

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<ScanRecord[]>([]);

  useEffect(() => {
    setRecords(getHistory());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link href="/" style={styles.logo}>
          <span style={styles.logoIcon}>&#9675;</span>
          <span style={styles.logoText}>AUDIT</span>
        </Link>
        <nav style={styles.nav}>
          <Link href="/" style={styles.navLink}>首页</Link>
          <Link href="/scan" style={styles.navLink}>扫描</Link>
          <Link href="/history" style={{ ...styles.navLink, ...styles.navActive }}>历史</Link>
        </nav>
        <span style={styles.version}>v0.2</span>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.title}>扫描历史</h1>

          {records.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>&#9744;</div>
              <p style={styles.emptyTitle}>暂无扫描记录</p>
              <p style={styles.emptyHint}>
                执行一次扫描后，记录将自动保存在此页面
              </p>
              <Link href="/" style={styles.emptyLink}>
                开始首次扫描 →
              </Link>
            </div>
          ) : (
            <div style={styles.list}>
              {records.map((record) => {
                const badge = riskBadge(record);
                return (
                  <div
                    key={record.id}
                    data-testid="history-row"
                    style={styles.row}
                    onClick={() => router.push(`/report/${record.id}`)}
                  >
                    <div style={styles.rowLeft}>
                      <time style={styles.time}>
                        {new Date(record.scannedAt).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      <p style={styles.path} title={record.projectPath}>
                        {record.projectPath.split("/").slice(-2).join("/")}
                      </p>
                    </div>

                    <div style={styles.severities}>
                      {(["critical", "high", "medium", "low"] as const).map(
                        (sev) =>
                          record.summary[sev] > 0 ? (
                            <span
                              key={sev}
                              style={{
                                ...styles.sevPill,
                                color: SEVERITY_COLORS[sev],
                                background: SEVERITY_BG[sev],
                              }}
                            >
                              {SEVERITY_LABELS[sev]} {record.summary[sev]}
                            </span>
                          ) : null,
                      )}
                    </div>

                    <span
                      style={{
                        ...styles.badge,
                        color: badge.color,
                        borderColor: badge.color,
                      }}
                    >
                      {badge.text}
                    </span>

                    <button
                      style={styles.deleteBtn}
                      onClick={(e) => handleDelete(record.id, e)}
                      title="删除记录"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer style={styles.footer}>
        <span>扫描在本地运行，历史记录仅保存在浏览器中</span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-primary)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    borderBottom: "1px solid var(--border)",
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
  nav: { display: "flex", gap: "24px" },
  navLink: {
    color: "var(--text-secondary)",
    fontSize: "13px",
    textDecoration: "none",
  },
  navActive: { color: "var(--text-primary)", fontWeight: 500 },
  version: { fontSize: "12px", color: "var(--text-muted)" },
  main: {
    flex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 24px",
  },
  card: {
    width: "100%",
    maxWidth: "720px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "40px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 600,
    marginBottom: "24px",
    color: "var(--text-primary)",
  },
  empty: {
    textAlign: "center" as const,
    padding: "64px 24px",
  },
  emptyIcon: {
    fontSize: "40px",
    color: "var(--text-muted)",
    marginBottom: "16px",
  },
  emptyTitle: {
    fontSize: "16px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    marginBottom: "8px",
  },
  emptyHint: {
    fontSize: "13px",
    color: "var(--text-muted)",
    marginBottom: "24px",
  },
  emptyLink: {
    color: "var(--accent)",
    fontSize: "14px",
    textDecoration: "none",
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "14px 16px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    cursor: "pointer",
    transition: "border-color 150ms ease",
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
  },
  time: {
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    color: "var(--text-secondary)",
    display: "block",
    marginBottom: "2px",
  },
  path: {
    fontSize: "12px",
    color: "var(--text-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: "240px",
  },
  severities: {
    display: "flex",
    gap: "6px",
    flexShrink: 0,
  },
  sevPill: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "10px",
    whiteSpace: "nowrap" as const,
  },
  badge: {
    fontSize: "12px",
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: "4px",
    border: "1px solid",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
    background: "transparent",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "18px",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
    flexShrink: 0,
  },
  footer: {
    textAlign: "center" as const,
    padding: "16px",
    fontSize: "12px",
    color: "var(--text-muted)",
    borderTop: "1px solid var(--border)",
  },
};
