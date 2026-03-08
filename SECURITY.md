# Security Policy

## Supported Versions

当前公开维护的主分支为最新版本，建议基于默认分支获取安全修复。

| Version | Supported |
| --- | --- |
| main / master | :white_check_mark: |
| 旧历史版本 | :x: |

## Reporting a Vulnerability

请不要在公开 Issue 中直接披露未修复漏洞的完整细节。

推荐流程：

1. 优先使用 GitHub 的私有漏洞报告（Private Vulnerability Reporting / Security Advisories）
2. 如果仓库暂未开启私有漏洞报告，请先提交一个不包含利用细节的简短 Issue，请求建立私下沟通渠道
3. 在问题修复并确认影响范围之前，请避免公开 PoC、攻击脚本、密钥样例或可直接复现的利用步骤

## Report Should Include

为了方便排查，请尽量提供：

- 漏洞类型与影响范围
- 受影响模块 / 路径 / 接口
- 复现步骤
- 触发条件
- 可能的风险等级与影响说明
- 如有修复建议，也欢迎一并给出

## Response Expectations

项目维护者建议按以下节奏处理：

- 7 天内确认收到报告
- 14 天内给出初步判断或修复计划
- 修复完成后，再决定是否公开详细信息

## Scope

以下问题通常属于安全问题处理范围：

- 认证绕过
- 权限提升
- 敏感信息泄露
- 任意文件读写
- 依赖漏洞引起的高风险利用链
- 注入类问题（SQL / 命令 / 模板等）
- 会话、JWT、OAuth、验证码流程相关问题

以下问题通常不作为安全漏洞单独处理：

- 普通功能缺陷
- 样式错乱
- 文案问题
- 无实际影响的低风险信息暴露

## Secrets Handling

公开仓库中不应包含：

- `.env`
- 服务器连接信息
- 部署密码、访问令牌、OAuth Secret
- 真实用户数据或私有数据库文件

如发现历史提交中存在敏感信息，请优先执行凭据轮换，再处理 Git 历史清理。
