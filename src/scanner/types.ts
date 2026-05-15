export type Severity = "critical" | "high" | "medium" | "low";

export type FindingCategory =
  | "security"
  | "privacy"
  | "compliance"
  | "payment"
  | "dependency";

export type Finding = {
  id: string;
  title: string;
  severity: Severity;
  category: FindingCategory;
  filePath?: string;
  line?: number;
  evidence?: string;
  whyItMatters: string;
  recommendation: string;
  references?: string[];
  source: string;
};

export type AdapterStatus = "success" | "failed" | "skipped";

export type AdapterResult = {
  adapterName: string;
  status: AdapterStatus;
  findings: Finding[];
  error?: string;
};

export type ScanResult = {
  projectPath: string;
  scannedAt: string;
  adapters: AdapterResult[];
  findings: Finding[];
};

export type ScanOptions = {
  maxFileSize?: number; // bytes, default 10MB
  exclude?: string[]; // directory/file names to skip
  config?: import("./config").AuditConfig; // optional config override
};

export interface ScannerAdapter {
  readonly name: string;
  scan(projectPath: string, options?: ScanOptions): Promise<Finding[]>;
  isAvailable(): boolean;
}
