# Issue 4: 实现小程序隐私接口扫描

**优先级：P0** | **预估：M (human: ~1d / CC: ~30min)**

## 描述

实现 `PrivacyRule`，扫描微信小程序中隐私相关风险：
- `getLocation` 等隐私 API 调用但无对应隐私声明
- `getUserProfile` 无用户授权流程
- `app.json` 缺少 `requiredPrivateInfos` 字段
- 隐私政策链接缺失或无效

## 产出

- `src/scanner/rules/mini-program-privacy.ts`
- 通过 AST 解析 `.js/.ts` 文件检测隐私 API 调用
- 解析 `app.json` 检查隐私配置

## 验收

- `mini-program-privacy.test.ts` 覆盖：getLocation 无声明、getUserProfile 无授权、app.json 缺失字段、隐私链接缺失
- fixture 项目包含对应漏洞
