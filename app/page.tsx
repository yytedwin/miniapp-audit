"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [projectPath, setProjectPath] = useState("");
  const [projectType, setProjectType] = useState("miniapp");

  const handleStartScan = () => {
    if (!projectPath.trim()) return;
    const params = new URLSearchParams({ path: projectPath, type: projectType });
    router.push(`/scan?${params.toString()}`);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>&#9675;</span>
          <span style={styles.logoText}>AUDIT</span>
        </div>
        <span style={styles.version}>v0.1</span>
      </header>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.card}>
          <h1 style={styles.title}>小程序上线前安全检查</h1>
          <p style={styles.subtitle}>
            本地静态扫描，不上传源码。检查密钥泄露、支付风险、隐私合规、权限漏洞。
          </p>

          {/* Project Path */}
          <div style={styles.field}>
            <label style={styles.label}>项目路径</label>
            <input
              type="text"
              placeholder="/path/to/your/miniapp"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStartScan()}
              style={styles.input}
              autoFocus
            />
            <p style={styles.hint}>输入本地项目文件夹的绝对路径</p>
          </div>

          {/* Project Type */}
          <div style={styles.field}>
            <label style={styles.label}>项目类型</label>
            <div style={styles.typeGroup}>
              {[
                { value: "miniapp", label: "微信小程序" },
                { value: "nextjs", label: "Next.js", disabled: true },
                { value: "generic", label: "前端 + API", disabled: true },
              ].map((t) => (
                <button
                  key={t.value}
                  disabled={t.disabled}
                  onClick={() => setProjectType(t.value)}
                  style={{
                    ...styles.typeBtn,
                    ...(projectType === t.value ? styles.typeBtnActive : {}),
                    ...(t.disabled ? styles.typeBtnDisabled : {}),
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartScan}
            disabled={!projectPath.trim()}
            style={{
              ...styles.startBtn,
              ...(!projectPath.trim() ? styles.startBtnDisabled : {}),
            }}
          >
            开始扫描
          </button>

          {/* Features */}
          <div style={styles.features}>
            {[
              { label: "密钥泄露", desc: ".env · API Key · JWT · 云密钥" },
              { label: "支付风险", desc: "验签缺失 · 金额篡改 · 回调幂等" },
              { label: "隐私合规", desc: "getLocation · getUserProfile · 声明" },
              { label: "权限漏洞", desc: "无鉴权 · 硬编码 · 越权查询" },
              { label: "依赖漏洞", desc: "npm advisory · CVE · 已知漏洞" },
            ].map((f) => (
              <div key={f.label} style={styles.featureItem}>
                <span style={styles.featureDot} />
                <span style={styles.featureLabel}>{f.label}</span>
                <span style={styles.featureDesc}>{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>扫描在本地运行，源码不会上传到任何服务器</span>
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
  },
  logoIcon: {
    color: "var(--accent)",
    fontSize: "10px",
  },
  logoText: { color: "var(--text-secondary)" },
  version: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
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
  title: {
    fontSize: "22px",
    fontWeight: 600,
    marginBottom: "8px",
    color: "var(--text-primary)",
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    marginBottom: "32px",
    lineHeight: 1.6,
  },
  field: { marginBottom: "24px" },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "8px",
    color: "var(--text-secondary)",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
    fontSize: "14px",
    outline: "none",
  },
  hint: {
    marginTop: "6px",
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  typeGroup: {
    display: "flex",
    gap: "8px",
  },
  typeBtn: {
    padding: "8px 16px",
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-secondary)",
    fontSize: "13px",
    cursor: "pointer",
  },
  typeBtnActive: {
    background: "var(--accent-dim)",
    border: "1px solid var(--accent)",
    color: "#fff",
  },
  typeBtnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  startBtn: {
    width: "100%",
    padding: "14px 24px",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: "32px",
  },
  startBtnDisabled: {
    opacity: 0.3,
    cursor: "not-allowed",
  },
  features: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    paddingTop: "24px",
    borderTop: "1px solid var(--border)",
  },
  featureItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "13px",
  },
  featureDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--accent)",
    flexShrink: 0,
    marginTop: "6px",
  },
  featureLabel: {
    color: "var(--text-primary)",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  featureDesc: {
    color: "var(--text-muted)",
    fontSize: "12px",
  },
  footer: {
    textAlign: "center",
    padding: "16px",
    fontSize: "12px",
    color: "var(--text-muted)",
    borderTop: "1px solid var(--border)",
  },
};
