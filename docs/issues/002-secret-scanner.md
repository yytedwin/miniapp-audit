# Issue 2: 实现密钥泄露扫描

**优先级：P0** | **预估：M (human: ~1d / CC: ~30min)**

## 描述

实现 `SecretScanner`，检测以下密钥泄露模式：
- `.env` 文件被提交到仓库
- 前端 JS/TS 文件中硬编码 API Key
- JWT Secret 明文
- 数据库连接串（含密码）
- 云服务密钥（腾讯云 SecretId/SecretKey、阿里云 AccessKey）

## 产出

- `src/scanner/adapters/secret-scanner.ts`
- 实现 `ScannerAdapter` 接口
- 正则模式匹配 + 文件路径匹配
- 10MB+ 文件和二进制文件自动跳过

## 验收

- `secret-scanner.test.ts` 覆盖：`.env` 检测、API Key 检测、JWT 检测、连接串检测、云密钥检测、超大文件跳过、二进制跳过
- 对 `fixtures/vulnerable-miniapp/` 扫描能发现预期密钥泄露
