import type { Finding } from "./types";

export function dedup(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();

  for (const f of findings) {
    const key = `${f.category}:${f.title}:${f.filePath ?? ""}:${f.line ?? 0}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, f);
    }
    // 如果已有同 key 的 finding，不同 source 时保留第一个
    // 实际场景中两个适配器发现同一行同一问题应该合并
  }

  return Array.from(seen.values());
}
