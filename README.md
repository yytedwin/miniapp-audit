# miniapp-audit

小程序上线前安全检查工具。本地静态扫描，不上传源码。

## 当前能力

| 扫描规则 | 适配器名称 | 检测内容 |
|----------|-----------|----------|
| 密钥泄露 | `secret-scanner` | API Key、JWT Secret、云密钥、.env 文件、PEM 私钥 |
| 依赖漏洞 | `dependency-scanner` | npm 已知安全漏洞 / advisory / CVE |
| 隐私合规 | `privacy-rule` | wx.getLocation 等隐私 API 未在 app.json 声明 |
| 支付风险 | `payment-rule` | 支付回调未验签、金额信任前端、无幂等处理 |
| 权限漏洞 | `authz-rule` | 无鉴权中间件、硬编码账号、IDOR 查询 |

| 报告格式 | CLI 参数 | 说明 |
|----------|----------|------|
| Markdown | `--format markdown` (默认) | 纯文本，适合开发者自用 |
| JSON | `--format json` | 结构化输出，供脚本和工具链消费 |
| HTML | `--format html` | 自包含 HTML 文件，可离线分享 |
| SARIF | `--format sarif` | SARIF 2.1.0，可接入 GitHub Code Scanning |

| 功能 | 说明 |
|------|------|
| 配置文件 | `miniapp-audit.config.json` 控制规则开关和排除路径 |
| Web UI | Next.js 界面，首页 → 扫描 → 报告 → 历史 |
| 扫描历史 | 浏览器 localStorage 持久化，最多 50 条，点击可回看历史报告 |
| E2E 测试 | Playwright smoke tests 覆盖首页 → 扫描 → 报告 → 历史页 |

## 快速开始

```bash
# 本地开发
npm install

# 运行测试
npm test

# 启动 Web UI
npm run dev
# 打开 http://localhost:3000
```

### 从 GitHub 或 npm 使用

发布到 npm 后可以直接运行：

```bash
npx miniapp-audit /path/to/your/project --format html --output report.html
```

也可以从 GitHub 克隆后在本机使用：

```bash
git clone https://github.com/your-name/miniapp-audit.git
cd miniapp-audit
npm install
npm run build:cli
./bin/miniapp-audit /path/to/your/project --format json --output report.json
```

### CLI 使用方式

```bash
# 基本用法（默认输出 Markdown）
miniapp-audit /path/to/your/project

# 指定输出路径
miniapp-audit /path/to/your/project --output ./my-report.md

# JSON 格式
miniapp-audit /path/to/your/project --format json --output report.json

# HTML 格式（自包含文件，可离线分享）
miniapp-audit /path/to/your/project --format html --output report.html

# SARIF 格式（可接入 CI/CD）
miniapp-audit /path/to/your/project --format sarif --output report.sarif

# 使用自定义配置文件
miniapp-audit /path/to/your/project --config ./my-rules.json

# 详细日志
miniapp-audit /path/to/your/project --verbose
```

## 配置文件

在项目根目录创建 `miniapp-audit.config.json`：

```json
{
  "rules": {
    "secret-scanner": { "enabled": true },
    "dependency-scanner": { "enabled": true },
    "privacy-rule": { "enabled": true },
    "payment-rule": { "enabled": true },
    "authz-rule": { "enabled": true }
  },
  "exclude": ["node_modules", ".git", "dist", "vendor"]
}
```

- `rules.<adapterName>.enabled` 设为 `false` 可禁用对应扫描规则
- `exclude` 指定要跳过的目录名（默认 `["node_modules", ".git", "dist"]`）
- 配置文件不存在时，所有规则默认启用
- CLI `--config <路径>` 可指定自定义配置文件位置

### 示例：禁用依赖扫描

```json
{
  "rules": {
    "dependency-scanner": { "enabled": false }
  }
}
```

### 示例：排除 utils 目录

```json
{
  "exclude": ["node_modules", ".git", "dist", "utils"]
}
```

## Web 使用方式

```bash
npm run dev
```

| 页面 | 路由 | 功能 |
|------|------|------|
| 首页 | `/` | 输入项目路径，选择项目类型，开始扫描 |
| 扫描页 | `/scan` | 显示扫描进度，5 个适配器并行执行 |
| 报告页 | `/report/[id]` | 按严重等级分组的 Findings，含证据和修复建议 |
| 历史页 | `/history` | 最近扫描记录列表，点击可回看历史报告 |

报告页在发现问题时会显示 **下载整改建议** 按钮，可下载 Markdown 文档到本地，内容包括上线判断、优先整改顺序、问题证据、修复建议和复查清单。

## 发布到 GitHub / npm 前

1. 把 `package.json` 里的 `homepage`、`repository.url`、`bugs.url` 改成你的 GitHub 仓库地址。
2. 如需开源，补充你选择的许可证文件，例如 `LICENSE`。没有许可证时，默认不授予他人复用权。
3. 本地跑完整验证：

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

4. 打包并本地安装验证：

```bash
npm pack
npm install -g ./miniapp-audit-*.tgz
miniapp-audit fixtures/vulnerable-miniapp --format json --output /tmp/miniapp-audit-report.json
```

5. 推送到 GitHub 后，CI 会自动跑类型检查、lint、测试、构建、依赖审计和 npm 包 smoke test。

## 验证命令

```bash
npm test              # 运行所有测试 (unit + integration)
npm run typecheck     # TypeScript 类型检查
npm run lint          # ESLint 检查
npm run build         # Next.js 构建
npm run test:e2e      # Playwright E2E smoke tests
npm audit --audit-level=moderate  # 依赖安全检查
```

### E2E Smoke Tests

使用 Playwright 验证 Web UI 核心路径。首次运行需安装 Chromium：

```bash
npx playwright install chromium
npm run test:e2e
```

覆盖路径：首页 → 输入路径 → 扫描 → 报告页 → 历史页 → 点击历史记录回报告。

E2E fixture 中通过 `miniapp-audit.config.json` 禁用 `dependency-scanner`，避免测试中出网访问 npm registry。Playwright 会自动在 `localhost:3100` 启动独立的 Next.js dev server，避免复用本地 `3000` 端口上的旧进程。

## 当前限制

- Web API 仅建议在本机 localhost 使用，不做用户鉴权
- 扫描历史保存在浏览器 localStorage，清除浏览器数据会丢失
- `dependency-scanner` 会访问 npm registry advisory API 查询依赖漏洞，不上传源码，但会发送 package 名称列表。如需完全离线扫描，可在配置中禁用 `dependency-scanner`
- 内置规则覆盖常见风险场景，不能替代人工安全审计
- 不执行用户代码，只做静态分析
- 源码不会被上传到任何服务器

## 技术栈

- TypeScript + Next.js
- Vitest (测试)
- Node.js >= 18
