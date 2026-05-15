# Issue 1: 定义扫描结果数据结构

**优先级：P0** | **预估：S (human: ~2h / CC: ~15min)**

## 描述

定义 `Finding` 类型、`Severity`、`ScannerAdapter` 接口等核心类型。所有后续任务依赖这个模块。

## 产出

- `src/scanner/types.ts` — Finding、Severity、ScannerAdapter、ScanResult 类型定义
- 完整的 TypeScript 类型和 JSDoc

## 验收

- `npm run typecheck` 通过
- 类型可以被其他模块导入使用
