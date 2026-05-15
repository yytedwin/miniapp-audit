import { describe, it, expect, beforeEach } from "vitest";
import { saveScan, saveScanRecord, getHistory, getRecord, deleteRecord, getReportResult } from "./history";
import type { ScanResult } from "./types";

function mockLocalStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
  return storage;
}

function makeResult(overrides?: Partial<ScanResult>): ScanResult {
  return {
    projectPath: "/tmp/test-project",
    scannedAt: "2026-05-14T10:00:00.000Z",
    adapters: [
      { adapterName: "secret-scanner", status: "success", findings: [] },
    ],
    findings: [
      {
        id: "test-1",
        title: "Test finding",
        severity: "critical",
        category: "security",
        whyItMatters: "test",
        recommendation: "fix",
        source: "secret-scanner",
      },
      {
        id: "test-2",
        title: "Test finding 2",
        severity: "high",
        category: "payment",
        whyItMatters: "test",
        recommendation: "fix",
        source: "payment-rule",
      },
    ],
    ...overrides,
  };
}

describe("scan history", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("保存后能读取记录", () => {
    const result = makeResult();
    const id = saveScanRecord(result);

    const history = getHistory();
    expect(history.length).toBe(1);
    expect(history[0].id).toBe(id);
    expect(history[0].projectPath).toBe("/tmp/test-project");
    expect(history[0].summary.critical).toBe(1);
    expect(history[0].summary.high).toBe(1);
    expect(history[0].summary.medium).toBe(0);
    expect(history[0].summary.low).toBe(0);
  });

  it("多条记录按时间倒序", () => {
    saveScanRecord(makeResult({ scannedAt: "2026-05-14T10:00:00.000Z" }));
    saveScanRecord(makeResult({ scannedAt: "2026-05-14T11:00:00.000Z" }));

    const history = getHistory();
    expect(history.length).toBe(2);
    // Most recent first
    expect(history[0].scannedAt).toBe("2026-05-14T11:00:00.000Z");
    expect(history[1].scannedAt).toBe("2026-05-14T10:00:00.000Z");
  });

  it("空历史返回空数组", () => {
    const history = getHistory();
    expect(history).toEqual([]);
  });

  it("按 ID 读取单条记录", () => {
    const id = saveScanRecord(makeResult());
    const record = getRecord(id);
    expect(record).toBeDefined();
    expect(record!.id).toBe(id);
  });

  it("不存在的 ID 返回 undefined", () => {
    const record = getRecord("nonexistent");
    expect(record).toBeUndefined();
  });

  it("删除记录", () => {
    const id = saveScanRecord(makeResult());
    const deleted = deleteRecord(id);
    expect(deleted).toBe(true);
    expect(getHistory().length).toBe(0);
  });

  it("删除不存在的记录返回 false", () => {
    expect(deleteRecord("nonexistent")).toBe(false);
  });

  it("超过 50 条时历史截断为 50", () => {
    for (let i = 0; i < 55; i++) {
      saveScanRecord(
        makeResult({
          scannedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
        }),
      );
    }

    const history = getHistory();
    expect(history.length).toBe(50);
  });

  it("超过 50 条时淘汰记录对应的完整报告也被删除", () => {
    // Save exactly 55 records, capture each id
    const ids: string[] = [];
    for (let i = 0; i < 55; i++) {
      const id = saveScanRecord(
        makeResult({
          scannedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
        }),
      );
      ids.push(id);
    }

    // ids[0]..ids[4] are the oldest 5, should be evicted
    for (let i = 0; i < 5; i++) {
      expect(getReportResult(ids[i])).toBeUndefined();
    }

    // ids[5]..ids[54] are the kept 50, should still have report data
    for (let i = 5; i < 55; i++) {
      expect(getReportResult(ids[i])).toBeDefined();
    }
  });

  it("删除单条记录时同步删除对应完整报告", () => {
    const result = makeResult();
    const id = saveScan(result);

    expect(getReportResult(id)).toBeDefined();

    deleteRecord(id);

    expect(getReportResult(id)).toBeUndefined();
    expect(getHistory().length).toBe(0);
  });

  it("保存和读取完整扫描结果", () => {
    const result = makeResult();
    const id = saveScan(result);

    const restored = getReportResult(id);
    expect(restored).toBeDefined();
    expect(restored!.projectPath).toBe("/tmp/test-project");
    expect(restored!.findings.length).toBe(2);
  });

  it("读取不存在的报告结果返回 undefined", () => {
    expect(getReportResult("nonexistent")).toBeUndefined();
  });

  it("无 findings 的记录统计为 0", () => {
    const id = saveScanRecord(makeResult({ findings: [] }));
    const record = getRecord(id)!;
    expect(record.summary.critical).toBe(0);
    expect(record.totalFindings).toBe(0);
  });
});
