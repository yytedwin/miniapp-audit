import { writeFile, readFile } from "fs/promises";
import { resolve } from "path";
import { scanProject } from "./scanner/scan-project";
import { generateMarkdown } from "./scanner/report/markdown";
import { generateJson } from "./scanner/report/json";
import { generateHtml } from "./scanner/report/html";
import { generateSarif } from "./scanner/report/sarif";
import type { ScanResult } from "./scanner/types";

type Format = "markdown" | "json" | "html" | "sarif";

const VALID_FORMATS: Format[] = ["markdown", "json", "html", "sarif"];

const FORMAT_EXTENSIONS: Record<Format, string> = {
  markdown: ".md",
  json: ".json",
  html: ".html",
  sarif: ".sarif",
};

export interface ParsedArgs {
  projectPath: string;
  format: Format;
  outputPath: string;
  configPath: string;
  verbose: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const help = argv.includes("--help") || argv.includes("-h");
  if (help || argv.length === 0) {
    return { projectPath: "", format: "markdown", outputPath: "", configPath: "", verbose: false, help: true };
  }

  const isOption = (a: string) => a.startsWith("-");

  // Find first non-option arg as projectPath
  const projectPath = argv.find((a, i) => {
    if (isOption(a)) return false;
    // Check previous arg isn't an option that takes a value
    if (i > 0) {
      const prev = argv[i - 1];
      if (prev === "--format" || prev === "--output" || prev === "-o" || prev === "--config") return false;
    }
    return true;
  });

  if (!projectPath) {
    throw new Error("缺少项目路径。用法: miniapp-audit <项目路径> [选项]");
  }

  // --format
  const formatIndex = argv.indexOf("--format");
  let format: Format = "markdown";
  if (formatIndex >= 0) {
    const value = argv[formatIndex + 1];
    if (!value || !VALID_FORMATS.includes(value as Format)) {
      throw new Error(
        `不支持的格式: ${value ?? "(未指定)"}。支持的格式: ${VALID_FORMATS.join(", ")}`,
      );
    }
    format = value as Format;
  }

  // --output
  const outputIndex = argv.findIndex((a) => a === "--output" || a === "-o");
  const outputPath =
    outputIndex >= 0 && argv[outputIndex + 1] && !isOption(argv[outputIndex + 1])
      ? argv[outputIndex + 1]
      : `./audit-report${FORMAT_EXTENSIONS[format]}`;

  // --config
  const configIndex = argv.indexOf("--config");
  const configPath =
    configIndex >= 0 && argv[configIndex + 1] && !isOption(argv[configIndex + 1])
      ? argv[configIndex + 1]
      : `${projectPath}/miniapp-audit.config.json`;

  const verbose = argv.includes("--verbose") || argv.includes("-v");

  return { projectPath, format, outputPath, configPath, verbose, help: false };
}

export function generateReport(result: ScanResult, format: Format): string {
  switch (format) {
    case "json":
      return generateJson(result);
    case "html":
      return generateHtml(result);
    case "sarif":
      return generateSarif(result);
    default:
      return generateMarkdown(result);
  }
}

function printHelp() {
  console.log("小程序上线前安全检查工具");
  console.log("");
  console.log("用法: miniapp-audit <项目路径> [选项]");
  console.log("");
  console.log("选项:");
  console.log("  --format <格式>       报告格式: markdown (默认), json, html, sarif");
  console.log("  --output, -o <路径>   报告输出路径 (默认: ./audit-report.<ext>)");
  console.log("  --config <路径>        配置文件路径 (默认: <项目路径>/miniapp-audit.config.json)");
  console.log("  --verbose, -v         显示详细日志");
  console.log("  --help, -h            显示帮助");
}

export function parseFormat(argv: string[]): Format {
  const formatIndex = argv.findIndex((a) => a === "--format");
  if (formatIndex < 0) return "markdown";

  const value = argv[formatIndex + 1];
  if (!value || !VALID_FORMATS.includes(value as Format)) {
    throw new Error(
      `不支持的格式: ${value ?? "(未指定)"}。支持的格式: ${VALID_FORMATS.join(", ")}`,
    );
  }

  return value as Format;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.help) {
    printHelp();
    return;
  }

  // Load custom config if --config is explicitly specified
  const configExplicitlySet = argv.includes("--config");
  let customConfig;
  if (configExplicitlySet) {
    let raw: string;
    try {
      raw = await readFile(args.configPath, "utf-8");
    } catch {
      throw new Error(`配置文件不存在: ${args.configPath}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `配置文件 JSON 格式错误: ${args.configPath}\n${error instanceof Error ? error.message : String(error)}`,
      );
    }
    customConfig = {
      rules: (parsed.rules as Record<string, { enabled: boolean }>) ?? {},
      exclude: Array.isArray(parsed.exclude) ? (parsed.exclude as string[]) : ["node_modules", ".git", "dist"],
    };
  }

  if (args.verbose) {
    console.log(`扫描项目: ${args.projectPath}`);
    console.log(`报告格式: ${args.format}`);
    if (configExplicitlySet) {
      console.log(`配置文件: ${args.configPath}`);
    }
  }

  const result = await scanProject(args.projectPath, { config: customConfig });

  if (args.verbose) {
    console.log(`扫描完成: ${result.findings.length} 个问题`);
    for (const adapter of result.adapters) {
      const status = adapter.status === "success" ? "OK" : "FAIL";
      console.log(
        `  ${status} ${adapter.adapterName}: ${adapter.findings.length} 个发现`,
      );
      if (adapter.error) {
        console.log(`    ${adapter.error}`);
      }
    }
  }

  const report = generateReport(result, args.format);
  const resolvedOutput = resolve(args.outputPath);
  await writeFile(resolvedOutput, report, "utf-8");

  console.log(`报告已生成: ${resolvedOutput}`);
  console.log(`共发现 ${result.findings.length} 个问题`);
}
