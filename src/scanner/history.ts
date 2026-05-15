import type { ScanResult } from "./types";

const STORAGE_KEY = "miniapp-audit:history";
const REPORT_KEY_PREFIX = "miniapp-audit:report:";
const MAX_RECORDS = 50;

export interface ScanRecord {
  id: string;
  projectPath: string;
  scannedAt: string;
  summary: { critical: number; high: number; medium: number; low: number };
  totalFindings: number;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // localStorage not available (SSR, etc.)
  }
  return null;
}

export function saveScan(result: ScanResult): string {
  const storage = getStorage();
  if (!storage) return "";

  const id = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Save full result for report page
  storage.setItem(REPORT_KEY_PREFIX + id, JSON.stringify(result));

  // Save summary to history list
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of result.findings) {
    if (f.severity in summary) {
      summary[f.severity]++;
    }
  }

  const record: ScanRecord = {
    id,
    projectPath: result.projectPath,
    scannedAt: result.scannedAt,
    summary,
    totalFindings: result.findings.length,
  };

  const history = readAll(storage);
  history.unshift(record);

  // Auto-cleanup: keep only latest MAX_RECORDS, remove orphaned report data
  if (history.length > MAX_RECORDS) {
    const evicted = history.slice(MAX_RECORDS);
    for (const r of evicted) {
      storage.removeItem(REPORT_KEY_PREFIX + r.id);
    }
    history.length = MAX_RECORDS;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(history));
  return id;
}

export function saveScanRecord(result: ScanResult): string {
  return saveScan(result);
}

function readAll(storage: Storage): ScanRecord[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScanRecord[];
  } catch {
    return [];
  }
}

export function getHistory(): ScanRecord[] {
  const storage = getStorage();
  if (!storage) return [];
  return readAll(storage);
}

export function getRecord(id: string): ScanRecord | undefined {
  const storage = getStorage();
  if (!storage) return undefined;
  return readAll(storage).find((r) => r.id === id);
}

export function deleteRecord(id: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const history = readAll(storage);
  const index = history.findIndex((r) => r.id === id);
  if (index < 0) return false;
  history.splice(index, 1);
  storage.setItem(STORAGE_KEY, JSON.stringify(history));
  // Also clean up the full report
  storage.removeItem(REPORT_KEY_PREFIX + id);
  return true;
}

export function getReportResult(id: string): ScanResult | undefined {
  const storage = getStorage();
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(REPORT_KEY_PREFIX + id);
    if (!raw) return undefined;
    return JSON.parse(raw) as ScanResult;
  } catch {
    return undefined;
  }
}
