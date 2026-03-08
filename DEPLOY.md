# 部署指南（域名 + HTTPS）

## 1. 前置准备

### 1.1 DNS 解析

在你的域名服务商控制台配置：

- `A` 记录：`@` -> 服务器公网 IP
- （可选）`A` 记录：`www` -> 同一公网 IP

### 1.2 端口放行

确保服务器防火墙/安全组已放行：

- `80/tcp`
- `443/tcp`

---

## 2. 环境变量

```bash
# 复制模板
cp .env.example .env
```

建议至少修改以下变量：

- `JWT_SECRET`：强随机字符串
- `DOMAIN=example.com`
- `ACME_EMAIL=your-email@example.com`
- `CORS_ORIGIN=https://example.com,https://www.example.com`
- `TRUST_PROXY=1`（部署在 Caddy/Nginx 后建议开启）

---

## 3. 启动部署（Docker Compose）

```bash
# 构建并启动（含 Caddy 反向代理）
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

---

## 4. 免重建热发布

本项目已将宿主机上的以下目录直接挂载到应用容器：

```bash
./packages/client/dist  -> /app/packages/client/dist
./packages/server/dist  -> /app/packages/server/dist
./packages/shared/dist  -> /app/packages/shared/dist
./scripts               -> /app/scripts
./prisma                -> /app/prisma
```

热发布脚本还会同步以下运行时配置到服务器：

```bash
./deploy
./docker-compose.yml
./Dockerfile
./package.json
./pnpm-lock.yaml
./pnpm-workspace.yaml
```

这意味着：

- 前端静态资源更新后，可直接热替换，无需重建镜像
- 后端构建产物更新后，会通过 `docker compose up -d --no-deps --force-recreate app` 立即生效
- Prisma 迁移、启动脚本与 Caddy 代理配置更新后，也能随宿主机同步生效

首次初始化：

```bash
copy .env.hot-deploy.example .env.hot-deploy.local
pnpm deploy:hot:init
```

说明：如果项目根目录 `AGENTS.md` 已写入服务器信息，脚本会自动读取；你也可以在 `.env.hot-deploy.local` 中覆盖默认值。

日常发布：

```bash
pnpm deploy:hot:client
pnpm deploy:hot:server
pnpm deploy:hot:all
pnpm deploy:hot:check
```

使用建议：

- 前端页面调整：执行 `pnpm deploy:hot:client`
- 后端逻辑、Prisma、脚本调整：执行 `pnpm deploy:hot:server`
- `docker-compose.yml` / `deploy/Caddyfile` 调整：建议重新执行 `pnpm deploy:hot:init`
- 上线后巡检：执行 `pnpm deploy:hot:check`

仍需重建镜像的情况：

```bash
docker compose up -d --build
```

- 新增 Node 依赖
- 更换基础镜像
- 依赖系统库 / 原生模块

---

## 5. 启动与验收说明

说明：

- 应用容器 `app` 仅在容器网络内部监听 `3000`
- 外部访问统一由 `caddy` 提供 `80/443`
- `caddy` 会自动申请和续期 HTTPS 证书

默认情况下，应用容器启动前会自动执行：

```bash
pnpm exec prisma migrate deploy
```

也就是说，后续只要执行：

```bash
docker compose up -d --build
```

即可在启动应用前自动完成迁移。

如果你确实想临时跳过自动迁移，可在 `.env` 中设置：

```bash
AUTO_MIGRATE=false
```

### 5.1 验收检查

项目已提供两类验收命令：

```bash
# 远端容器 / 挂载 / 健康检查
pnpm deploy:hot:check

# 域名侧验收
pnpm verify:domain -- example.com
```

这两条命令合起来会检查：

1. `app` / `caddy` 容器状态
2. `packages/client/dist`、`packages/server/dist`、`packages/shared/dist`、`scripts`、`prisma` 挂载是否全部到位
3. `https://example.com/api/health` 可用性
4. `http://example.com` 行为（是否跳转 HTTPS）

---

## 6. 研招单位官方源库恢复

如果服务器内存较小，不想在线抓取全国研招单位官方源，可直接使用项目内快照恢复：

```bash
pnpm import:graduate-school-sources:snapshot
```

默认快照文件：

```bash
scripts/data/graduate-school-sources.snapshot.json
```

如需在本地重新抓取并刷新快照，可执行：

```bash
pnpm import:graduate-school-sources
pnpm export:graduate-school-sources:snapshot
```

---

## 7. 数据持久化

数据库文件存储在 `./data` 目录，容器重启后数据不会丢失。

---

## 8. 常见问题

### 8.1 HTTPS 一直签发失败

优先检查：

1. DNS 是否已生效（可用 `nslookup example.com`）
2. 80/443 端口是否放行
3. 是否有其它服务占用 80/443

### 8.2 页面能打开但接口报跨域

检查 `.env` 中 `CORS_ORIGIN` 是否包含你的实际访问域名（支持逗号分隔）。

### 8.3 容器启动失败

```bash
docker compose logs app
docker compose logs caddy
```
