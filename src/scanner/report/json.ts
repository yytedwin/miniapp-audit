import type { ScanResult } from "../types";

export function generateJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
