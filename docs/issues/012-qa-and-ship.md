# Issue 12: QA 测试和发布检查

**优先级：P1** | **预估：L (human: ~1d / CC: ~1h)**

## 描述

运行全面验证：
- 全量测试 (`npm test`)
- 类型检查 (`npm run typecheck`)
- Lint (`npm run lint`)
- 构建 (`npm run build`)
- Web UI 浏览器测试（首页、扫描、报告、详情）
- 移动端兼容性检查

## 产出

- QA 报告
- 已知问题列表
- 发布清单

## 依赖

- Issue 1-11 全部完成

## 验收

- `npm test` 全绿
- `npm run build` 成功
- Web UI 4 页可正常访问
- 对 fixture 项目扫描结果准确
