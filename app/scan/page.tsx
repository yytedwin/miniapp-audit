"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ScanResult } from "@/src/scanner/types";
import { saveScan } from "@/src/scanner/history";

type AdapterState = {
  name: string;
  label: string;
  status: "pending" | "running" | "success" | "failed";
  count: number;
  error?: string;
};

const ADAPTER_LABELS: Record<string, string> = {
  "secret-scanner": "密钥泄露扫描",
  "dependency-scanner": "依赖风险扫描",
  "privacy-rule": "隐私合规扫描",
  "payment-rule": "支付风险扫描",
  "authz-rule": "权限漏洞扫描",
};

function ScanPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const projectPath = params.get("path") ?? "";
  const [phase, setPhase] = useState<"scanning" | "complete" | "error">("scanning");
  const [adapters, setAdapters] = useState<AdapterState[]>(
    Object.entries(ADAPTER_LABELS).map(([name, label]) => ({
      name,
      label,
      status: "pending",
      count: 0,
    })),
  );

  const runScan = useCallback(async () => {
    try {
      setAdapters((prev) => prev.map((a) => ({ ...a, status: "running" })));

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const result = (await res.json()) as ScanResult;

      // Map results back to adapter states
      const updatedAdapters = Object.entries(ADAPTER_LABELS).map(([name, label]) => {
        const adapterResult = result.adapters.find(
          (r) => r.adapterName === name,
        );
        return {
          name,
          label,
          status:
            adapterResult?.status === "success"
              ? ("success" as const)
              : ("failed" as const),
          count: adapterResult?.findings.length ?? 0,
          error:
            adapterResult?.status !== "success"
              ? adapterResult?.error
              : undefined,
        };
      });

      setAdapters(updatedAdapters);
      setPhase("complete");

      // Navigate to report after a brief pause so user sees completion
      setTimeout(() => {
        const reportId = saveScan(result);
        // Keep sessionStorage for adapter states (report page uses it)
        sessionStorage.setItem(
          `report-adapters-${reportId}`,
          JSON.stringify(updatedAdapters),
        );
        router.push(`/report/${reportId}`);
      }, 1000);
    } catch {
      setPhase("error");
      setAdapters((prev) =>
        prev.map((a) =>
          a.status === "running" ? { ...a, status: "failed" } : a,
        ),
      );
    }
  }, [projectPath, router]);

  useEffect(() => {
    if (!projectPath) {
      router.push("/");
      return;
    }
    runScan();
  }, [projectPath, runScan, router]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link href="/" style={styles.logo}>
          <span style={styles.logoIcon}>&#9675;</span>
          <span style={styles.logoText}>AUDIT</span>
        </Link>
        <span style={styles.phaseLabel}>
          {phase === "scanning" ? "扫描中..." : phase === "complete" ? "扫描完成" : "扫描失败"}
        </span>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.title}>正在扫描</h1>
          <p style={styles.path}>
            <code>{projectPath}</code>
          </p>

          {/* Progress bar */}
          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${(adapters.filter((a) => a.status !== "pending" && a.status !== "running").length / adapters.length) * 100}%`,
                ...(phase === "complete" ? styles.progressComplete : {}),
                ...(phase === "error" ? styles.progressError : {}),
              }}
            />
          </div>

          {/* Adapter list */}
          <div style={styles.adapterList}>
            {adapters.map((adapter) => (
              <div key={adapter.name} style={styles.adapterRow}>
                <span style={statusIconStyle(adapter.status)}>
                  {adapter.status === "pending" ? "○" : adapter.status === "running" ? "◎" : adapter.status === "success" ? "●" : "✕"}
                </span>
                <span style={styles.adapterLabel}>{adapter.label}</span>
                <span style={styles.adapterCount}>
                  {adapter.status === "success" ? `${adapter.count} 个问题` : adapter.status === "failed" ? "失败" : adapter.status === "running" ? "扫描中..." : "等待中"}
                </span>
                {adapter.error && (
                  <span style={styles.adapterError}>{adapter.error}</span>
                )}
              </div>
            ))}
          </div>

          {phase === "complete" && (
            <p style={styles.redirectHint}>正在跳转到报告页面...</p>
          )}
          {phase === "error" && (
            <button onClick={() => router.push("/")} style={styles.backBtn}>
              返回首页
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function statusIconStyle(status: string): React.CSSProperties {
  const colors: Record<string, string> = {
    pending: "var(--text-muted)",
    running: "var(--accent)",
    success: "var(--success)",
    failed: "var(--critical)",
  };
  return {
    color: colors[status] ?? "var(--text-muted)",
    fontSize: "14px",
    width: "20px",
  };
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
  phaseLabel: { fontSize: "13px", color: "var(--text-secondary)" },
  main: {
    flex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 24px",
  },
  card: {
    width: "100%",
    maxWidth: "560px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "40px",
  },
  title: { fontSize: "22px", fontWeight: 600, marginBottom: "8px" },
  path: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    marginBottom: "24px",
    wordBreak: "break-all",
  },
  progressTrack: {
    height: "3px",
    background: "var(--border)",
    borderRadius: "2px",
    marginBottom: "32px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--accent)",
    borderRadius: "2px",
    transition: "width 0.5s ease",
    width: "0%",
  },
  progressComplete: { background: "var(--success)" },
  progressError: { background: "var(--critical)" },
  adapterList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "24px",
  },
  adapterRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
  },
  adapterLabel: {
    fontSize: "14px",
    fontWeight: 500,
    flex: 1,
  },
  adapterCount: {
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
  adapterError: {
    fontSize: "12px",
    color: "var(--critical)",
    display: "block",
    width: "100%",
  },
  redirectHint: {
    textAlign: "center",
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
  backBtn: {
    display: "block",
    margin: "0 auto",
    padding: "10px 24px",
    background: "var(--border)",
    border: "none",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontSize: "14px",
    cursor: "pointer",
  },
};

export default function ScanPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>加载中...</div>}>
      <ScanPageContent />
    </Suspense>
  );
}
