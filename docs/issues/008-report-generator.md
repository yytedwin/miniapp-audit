# Issue 8: 实现 Markdown 报告生成

**优先级：P0** | **预估：S (human: ~4h / CC: ~20min)**

## 描述

实现 `ReportGenerator`，将 `Finding[]` 转换为结构化的 Markdown 报告。

## 产出

- `src/scanner/report/markdown.ts`
- 按严重等级分组（Critical → High → Medium → Low）
- 输出格式：项目名、扫描时间、总体风险、分组 Findings
- 每条 Finding：标题、严重等级、文件路径+行号、证据、解释、修复建议
- 空 Findings → "未发现问题"
- 100+ Findings → 不撑爆输出
- CLI 调用入口：`bin/miniapp-audit` 输出 .md 文件

## 依赖

- Issue 7 (scan engine)

## 验收

- `markdown.test.ts` 覆盖：空结果、1 条 Finding、多等级混合、100+ Findings 压力测试
