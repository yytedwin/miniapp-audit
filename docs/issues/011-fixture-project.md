# Issue 11: 构建 Fixture 项目

**优先级：P0** | **预估：M (human: ~1d / CC: ~30min)**

## 描述

构建 `fixtures/vulnerable-miniapp/`，包含已知漏洞的完整微信小程序项目，作为集成测试和演示的基准。

## 必须包含的漏洞

1. `.env` 文件包含 `API_KEY=sk-xxx` 和 `DB_PASSWORD=xxx`
2. `utils/payment.js` 中支付回调无验签
3. `app.json` 缺少 `requiredPrivateInfos`，但代码中调用了 `getLocation`
4. `package-lock.json` 包含已知高危依赖（或 mock 一个）
5. 某 API 路由无鉴权直接返回用户数据
6. 前端 JS 中硬编码了腾讯云 SecretId/SecretKey

## 产出

- `fixtures/vulnerable-miniapp/` 完整项目
- `fixtures/vulnerable-miniapp/expected-findings.json` — 预期发现 ≥ 10 条

## 验收

- 集成测试对 fixture 扫描结果与 `expected-findings.json` 完全匹配
