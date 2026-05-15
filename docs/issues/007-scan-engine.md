# Issue 7: 实现扫描引擎 + 全局去重

**优先级：P0** | **预估：M (human: ~1d / CC: ~30min)**

## 描述

实现 `scanProject()` 核心逻辑和 `dedup()` 全局去重。这是所有适配器的编排层。

## 产出

- `src/scanner/scan-project.ts` — `scanProject(path)` 单一入口
- `src/scanner/dedup.ts` — `dedup(findings: Finding[])` 全局去重
- 路径校验（存在性、可读性、目录类型）
- 路径遍历防护（限制在项目根目录内）
- 所有适配器并行执行，独立失败
- 扫描结果聚合 + 标注每个适配器状态

## 依赖

- Issue 1 (core types)
- Issue 2-6 (adapters)

## 验收

- `scan-project.test.ts` 覆盖：正常扫描、路径不存在、无权限、某适配器失败、空项目、所有适配器成功
- `dedup.test.ts` 覆盖：无重复、同文件同行去重、跨适配器去重、空数组
