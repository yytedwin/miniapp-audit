# Issue 9: 实现 CLI 入口

**优先级：P0** | **预估：S (human: ~3h / CC: ~15min)**

## 描述

实现 `npx miniapp-audit` CLI 入口，调用扫描引擎并输出报告。

## 产出

- `bin/miniapp-audit` CLI 入口
- `package.json` 中 `bin` 字段配置
- `--verbose` 模式输出详细日志
- `--output` 指定报告输出路径（默认当前目录）
- 控制台输出扫描摘要

## 依赖

- Issue 8 (report generator)

## 验收

- E2E: `npx miniapp-audit ./fixtures/vulnerable-miniapp` 能运行并输出 .md 报告
