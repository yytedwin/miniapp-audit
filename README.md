# miniapp-audit

本地运行的微信小程序上线前安全检查工具，支持 Web UI 和 CLI 双模式，帮助你在提审或发布前快速发现常见安全与合规风险。

## Why this project

- 不上传源码，适合本地自查
- 同时支持 Web 界面和命令行
- 支持 Markdown、JSON、HTML、SARIF 四种报告输出
- 扫描结果可导出为整改建议文档，方便给开发、测试、运营协作处理

## What it checks

| 类别 | 检测内容 |
|------|----------|
| 密钥泄露 | API Key、JWT Secret、云密钥、`.env`、PEM 私钥 |
| 依赖漏洞 | npm 已知安全漏洞 / advisory / CVE |
| 隐私合规 | `wx.getLocation` 等隐私 API 未在 `app.json` 声明 |
| 支付风险 | 回调未验签、金额信任前端、无幂等处理 |
| 权限漏洞 | 缺失鉴权、硬编码账号、IDOR 查询 |

## Output formats

| 格式 | 参数 | 适合场景 |
|------|------|----------|
| Markdown | `--format markdown` | 开发者本地查看 |
| JSON | `--format json` | 脚本处理、二次集成 |
| HTML | `--format html` | 离线分享、归档留存 |
| SARIF | `--format sarif` | 接入 GitHub Code Scanning / 安全平台 |

## Quick start

### 1. 本地 Web UI

```bash
npm install
npm run dev
```

然后打开 [http://localhost:3000](http://localhost:3000)。

### 2. 本地 CLI

```bash
npm install
npm run build:cli
./bin/miniapp-audit /path/to/your/project --format html --output report.html
```

### 3. 从 GitHub 克隆

```bash
git clone https://github.com/yytedwin/miniapp-audit.git
cd miniapp-audit
npm install
npm run build:cli
./bin/miniapp-audit /path/to/your/project --format json --output report.json
```

### 4. 未来从 npm 使用

发布后可直接运行：

```bash
npx miniapp-audit /path/to/your/project --format html --output report.html
```

## CLI examples

```bash
# 默认输出 Markdown
miniapp-audit /path/to/your/project

# 指定输出路径
miniapp-audit /path/to/your/project --output ./my-report.md

# JSON 报告
miniapp-audit /path/to/your/project --format json --output report.json

# HTML 报告
miniapp-audit /path/to/your/project --format html --output report.html

# SARIF 报告
miniapp-audit /path/to/your/project --format sarif --output report.sarif

# 自定义配置文件
miniapp-audit /path/to/your/project --config ./miniapp-audit.config.json

# 输出详细日志
miniapp-audit /path/to/your/project --verbose
```

## Web workflow

| 页面 | 路由 | 功能 |
|------|------|------|
| 首页 | `/` | 输入项目路径并发起扫描 |
| 扫描页 | `/scan` | 显示扫描过程与规则执行状态 |
| 报告页 | `/report/[id]` | 查看问题详情、风险等级、修复建议 |
| 历史页 | `/history` | 查看最近扫描记录并回看历史报告 |

如果报告中发现问题，页面会提供“下载整改建议”文档，自动整理：

- 是否建议上线
- 问题证据和受影响文件
- 优先处理顺序
- 修复建议
- 复查清单

## Config file

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

- `rules.<adapterName>.enabled = false` 可以禁用某条规则
- `exclude` 可以排除不需要扫描的目录
- 不传 `--config` 时会使用默认规则

## Verification

当前公开版本已完成以下验证：

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

其中 E2E 使用 Playwright 覆盖首页、扫描、报告、历史页的主路径。

## npm publish checklist

```bash
npm install
npm run build:cli
npm pack
npm publish --access public
```

首次运行 E2E 如缺少浏览器：

```bash
npx playwright install chromium
```

## Limitations

- 仅建议在本机 `localhost` 使用 Web API，不做多用户鉴权
- 扫描历史保存在浏览器 `localStorage`
- `dependency-scanner` 会访问 npm advisory API，但不会上传源码
- 这是静态分析工具，不能替代人工安全审计

## Tech stack

- TypeScript
- Next.js
- React
- Vitest
- Playwright

## Roadmap

- 更完整的 SARIF rule metadata
- 更多小程序审核类规则
- 更细粒度的项目类型模板
- npm 正式发布后的安装与版本管理

## License

MIT
