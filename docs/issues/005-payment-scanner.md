# Issue 5: 实现支付回调风险扫描

**优先级：P0** | **预估：M (human: ~1d / CC: ~30min)**

## 描述

实现 `PaymentRule`，扫描微信支付回调相关风险：
- 支付回调缺少签名验证（`wx.requestPayment` 或服务端回调）
- 订单金额信任前端传入
- 重复回调通知无幂等处理
- 回调处理无日志

## 产出

- `src/scanner/rules/payment-callback.ts`
- AST 模式匹配检测回调处理函数

## 验收

- `payment-callback.test.ts` 覆盖：无验签、金额信任前端、无幂等、无日志
- fixture 项目包含对应漏洞
