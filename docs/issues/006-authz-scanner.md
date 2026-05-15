# Issue 6: 实现权限风险扫描

**优先级：P0** | **预估：M (human: ~1d / CC: ~30min)**

## 描述

实现 `AuthzRule`，扫描权限相关风险：
- 接口无鉴权中间件
- 管理员账号硬编码
- 用户数据越权读取（通过 ID 直接查询而没有校验归属）

## 产出

- `src/scanner/rules/authz.ts`
- AST 模式匹配检测鉴权缺失

## 验收

- `authz.test.ts` 覆盖：无鉴权路由、硬编码账号、越权查询
- fixture 项目包含对应漏洞
