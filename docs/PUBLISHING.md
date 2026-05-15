# Publishing

## npm publish

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm audit --audit-level=moderate
npm pack
npm publish --access public
```

## Restore GitHub Actions CI

当前仓库本地已准备好 `.github/workflows/ci.yml`，但如果使用 Personal Access Token 推送该文件，token 需要包含 `workflow` scope。

如果当前 token 不含该权限，GitHub 会拒绝更新 workflow 文件。

恢复方式：

```bash
# 1. 生成一个带 workflow 权限的新 PAT

# 2. 在仓库根目录取消对 workflow 的忽略
sed -i '' '/^.github\\/workflows\\//d' .gitignore

# 3. 提交 workflow
git add .github/workflows/ci.yml .gitignore
git commit -m "ci: restore GitHub Actions workflow"

# 4. 推送
git push origin main
```

## Suggested release flow

1. 先完成 GitHub README、LICENSE、CHANGELOG 检查
2. 再恢复 GitHub Actions CI
3. 最后发布 npm，确保 README 中的安装方式与包名一致
