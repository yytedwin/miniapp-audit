# Issue 3: 实现依赖风险扫描

**优先级：P0** | **预估：M (human: ~1d / CC: ~30min)**

## 描述

实现 `DependencyScanner`，解析 `package-lock.json`，调用 npm advisory API 查询已知漏洞。API 不可用时降级并标注。

## 产出

- `src/scanner/adapters/dependency-scanner.ts`
- npm advisory API 调用逻辑（含超时 30s、429 退避重试）
- 降级策略：API 失败时标注 "依赖扫描: 网络不可用"
- 无 `package-lock.json` 时跳过并标注

## 验收

- `dependency-scanner.test.ts` 覆盖：正常查询、API 超时降级、API 429 重试、无 lock 文件、高危 CVE 报告
- mock npm API 响应
