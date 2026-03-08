# Contributing Guide

感谢你关注这个项目。

本项目欢迎 Issue、文档修正、功能建议与代码贡献。为了减少维护成本、提升协作效率，请在提交前阅读以下约定。

参与协作时，也请同步遵守：[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## 贡献方式

### 报告问题

请优先使用 GitHub Issue 模板，并尽量提供：

- 问题现象与预期行为
- 复现步骤
- 浏览器 / 操作系统 / Node.js 版本
- 日志、报错截图或接口返回信息

### 提交功能建议

建议在提交 Pull Request 之前先开 Feature Request 模板或普通 Issue，说明：

- 你要解决什么问题
- 为什么当前实现不够用
- 你计划采用什么方式实现

### 提交代码

建议流程：

1. Fork 仓库
2. 新建特性分支
3. 保持改动聚焦，避免把无关重构混在同一个 PR 里
4. 提交前运行校验
5. 发起 Pull Request，并尽量按 PR 模板说明改动背景与验证结果

## 本地开发

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

## 提交前检查

请至少确保以下命令通过：

```bash
pnpm lint
pnpm build
```

如果改动涉及部署、脚本、环境变量、导入导出链路，请同步更新：

- `README.md`
- `DEPLOY.md`
- `CHANGELOG.md`

## Pull Request 建议规范

### 标题建议

可参考以下前缀：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 重构
- `chore:` 工程调整
- `perf:` 性能优化
- `test:` 测试相关

### 描述建议

建议包含：

- 背景
- 改动内容
- 验证方式
- 影响范围

## 安全与隐私要求

请不要提交以下内容：

- `.env`
- `.env.hot-deploy.local`
- 服务器地址、SSH 密钥、密码、Token
- 数据库文件、真实用户数据、导出快照
- 仅用于本地调试的临时脚本或个人资料

如果改动涉及安全问题，请先阅读：[SECURITY.md](./SECURITY.md)

## 代码风格

- 尽量保持现有项目结构与命名风格一致
- 避免引入与当前架构不匹配的大型抽象
- 注释应简洁、明确，优先解释“为什么”而不是“是什么”
- 文档与提交信息优先保证可读性与可维护性

## 许可证

向本项目提交代码即表示你同意你的贡献在本仓库的 [MIT License](./LICENSE) 下发布。
