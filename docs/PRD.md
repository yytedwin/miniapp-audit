# PRD: 小程序上线前安全检查工具

## 版本路线

| 版本 | 目标 |
|------|------|
| v0.1 (MVP) | 核心扫描引擎 + Markdown 报告 + CLI + Web UI |
| v0.2 (当前) | 多格式报告导出 + 规则配置 + 历史持久化 + 使用文档 + Smoke tests |

## Problem Statement

外包团队和独立开发者用 AI 工具写了小程序代码，但不确定能不能过审。他们需要一个工具在上线前扫描常见安全问题：密钥会不会泄露、支付回调能不能被伪造、隐私声明会不会导致拒审。最终要交出一份能看懂的整改报告给甲方。

## Solution

本地代码扫描工具。用户指定项目路径，工具自动扫描 5 类常见风险，输出一份按严重等级分组的 Markdown 报告。报告明确指出哪些问题阻塞上线、每个问题在哪个文件、怎么改。

## User Stories

1. As a 小程序外包开发者, I want 扫描项目中的密钥泄露, so that 不会把生产密钥提交到代码仓库导致安全事故
2. As a 小程序外包开发者, I want 检查支付回调是否验签, so that 避免回调被伪造导致资金损失
3. As a 小程序外包开发者, I want 检查隐私接口是否声明, so that 微信审核不会因为隐私问题拒审
4. As a 小程序外包开发者, I want 扫描依赖中的高危漏洞, so that 不会引入已知的安全漏洞
5. As a 小程序外包开发者, I want 检查接口是否有鉴权, so that 用户数据不会被越权访问
6. As a 外包团队负责人, I want 一份能直接发给甲方老板看的报告, so that 证明代码已经过安全检查
7. As a 独立开发者, I want 一行命令就能扫描, so that 不需要部署服务或注册账号
8. As a 独立开发者, I want 在浏览器里查看和分享报告, so that 方便和合作方沟通
9. As a 开发者, I want 每个问题都有文件路径和行号, so that 我知道去哪里改
10. As a 开发者, I want 每个问题都有修复建议, so that 我不需要自己去搜怎么改
11. As a 开发者, I want 同一问题不重复报, so that 报告不会臃肿难读
12. As a 开发者, I want 扫描失败时仍然有部分结果, so that 不会白跑一次
13. As a 开发者, I want 扫描时我的源码不上传到任何服务器, so that 代码安全有保障

## Implementation Decisions

### 模块架构

- **扫描引擎 (Scanner Engine)**：`scanProject(path)` 单一入口，返回 `Finding[]`
- **5 个适配器**：均实现 `ScannerAdapter` 接口（`name`、`scan()`、`isAvailable()`）
  - SecretScanner：正则 + 文件路径匹配检测密钥泄露
  - DependencyScanner：解析 `package-lock.json` + npm advisory API 检测依赖漏洞，API 不可用时降级到本地库
  - PrivacyRule：AST 模式匹配检测隐私接口调用（getLocation、getUserProfile 等）
  - PaymentRule：AST 模式匹配检测支付回调（验签缺失、金额信任前端）
  - AuthzRule：AST 模式匹配检测权限风险（无鉴权中间件、硬编码账号）
- **全局去重**：`dedup(findings: Finding[])` 按 `${category}:${filePath}:${fingerprint}` 去重
- **报告生成**：`ReportGenerator.generate(findings: Finding[])` 按严重等级分组输出 Markdown

### 执行策略

- 所有适配器并行执行，各自独立
- 某适配器失败不影响其他适配器
- 扫描结果标注每个适配器的成功/失败状态

### 安全基线

- 路径遍历防护：限制扫描范围在项目根目录内
- 单文件上限：10MB，超过跳过
- Web UI 绑定 localhost，v1 不做用户鉴权
- 从不执行用户代码，只做静态分析
- 从不将用户源码上传到任何外部服务

### 报告结构

Markdown 报告按以下顺序：
1. 项目名、扫描时间、总体风险等级
2. 阻塞上线问题 (Critical)
3. 建议整改问题 (High & Medium)
4. 提醒项 (Low)
5. 每条 Finding：证据、解释、修复建议

### Finding 数据结构

```ts
type Severity = "critical" | "high" | "medium" | "low";

type Finding = {
  id: string;
  title: string;
  severity: Severity;
  category: "security" | "privacy" | "compliance" | "payment" | "dependency";
  filePath?: string;
  line?: number;
  evidence?: string;
  whyItMatters: string;
  recommendation: string;
  references?: string[];
  source: string;  // 适配器名称
};
```

## Testing Decisions

- 测试类型：单元测试（jest/vitest）为主，集成测试覆盖 `scanProject()` 全流程，E2E 测试覆盖 CLI 入口
- 测试原则：只测试外部行为，不测试实现细节。每条规则有独立的测试用例
- Fixture 策略：`fixtures/vulnerable-miniapp/` 包含已知漏洞的完整小程序项目，附带 `expected-findings.json`
- 覆盖率目标：每条规则的 happy path + 错误路径 + 边界情况
- 31 条测试路径已在工程评审中映射完毕

## v0.2 Scope

以下从 v0.1 Out of Scope 移入 v0.2：

### 多格式报告导出

- **JSON 报告**：直接序列化 `ScanResult`，`JSON.stringify(result, null, 2)`
- **HTML 报告**：自包含静态 HTML 文件，内联 CSS/JS，双击浏览器打开即可交付。不依赖 Next.js 运行时
- **SARIF 报告**：输出符合 SARIF 2.1.0 规范的最小有效 JSON。只填充 `runs[0].tool`、`runs[0].results`、`runs[0].invocations`，不做 taxonomies/rules 映射
- 三个生成器和现有 Markdown generator 平级放在 `src/scanner/report/`
- CLI 新增 `--format` 参数：`markdown`（默认）、`json`、`html`、`sarif`
- v0.2 只做**开发者版**报告。客户版通过字段过滤实现，不在 v0.2 范围

### 规则配置文件

- 文件：项目根目录 `miniapp-audit.config.json`
- 配置项：
  - `rules`: 按规则名开关，如 `{ "secret-scanner": { "enabled": false } }`
  - `exclude`: 排除路径数组，如 `["node_modules", "dist", ".git"]`
- 配置加载器：`src/scanner/config.ts`，`loadConfig(projectPath: string) => AuditConfig`
- CLI 优先使用项目配置，无配置文件时使用全部规则默认启用

### Web 扫描历史持久化

- 使用浏览器 `localStorage` 存储最近扫描记录
- 每条记录：项目路径、扫描时间、风险摘要（各级别数量）、报告 ID
- 扫描历史页面列出所有记录，可点击查看详情或删除
- 不存储完整 Findings（报告本身可导出为文件保存）

### README 使用文档

- 安装方式（npm / npx）
- CLI 命令参考（`--format`, `--output`, `--verbose`, `--config`）
- 配置文件说明
- Web UI 使用说明
- 扫描规则清单和说明
- 报告格式说明

### Playwright Smoke Tests

- 启动 Next.js dev server
- 访问首页、扫描页、报告页
- 执行一次完整扫描流程
- 验证 CLI `--format` 四种格式输出
- 不测具体规则结果（单元测试已覆盖）

## Out of Scope (v0.2)

- 用户登录注册
- 真实支付/收费
- 云端托管用户源码
- 自动执行用户代码
- 客户版报告（开发者版报告可过滤字段得到客户版，但 v0.2 不做独立的客户版渲染）
- 外部工具适配器（gitleaks、semgrep）
- 依赖漏洞离线库（v1 仅 npm API + 降级标注）
- 法律意义上的"保证合规"
- PDF 导出
- 自动修复代码

## 成功标准

一个真实小程序项目扫描完成后，开发者能回答 5 个问题：
1. 哪里可能泄露密钥？
2. 哪里可能被伪造支付？
3. 哪里可能因为隐私声明被拒审？
4. 哪些问题会阻塞上线？
5. 我下一步应该改哪个文件？

## Further Notes

- 技术栈：Next.js + TypeScript
- 交付模式：CLI (`npx miniapp-audit`) + Web UI (Next.js, localhost)
- 依赖：Node.js >= 18, npm >= 9
- 第一版报告语言：中文
