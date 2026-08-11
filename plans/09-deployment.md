# 09 · 发布与部署架构

> 模块定位：定义仓库、前端/后端部署、CI/CD、安全合规。GitHub 托管，前后端分离。
> 上级索引：[00-overview.md](./00-overview.md)

## 9.1 仓库

- 仓库：`github.com/fuyouling/video2text-web`
- 结构：前端（Astro，仓库根） + 后端（`backend/` 子目录，独立可部署）
- 分支策略：`main`（生产） + `dev`（开发） + PR 预览；`main` 保护 + CI 必过
- `main` 保护规则：必需 CI 通过、至少一次 review（可自评），禁止直推

## 9.2 前端部署（Cloudflare Pages）

- 构建：`npm ci && npm run build`（Astro 静态输出），锁定 `NODE_VERSION`
- 托管：**Cloudflare Pages**，域名由 Cloudflare 托管，免备案
- **部署方式二选一（避免重复部署冲突）**：
  - **A（推荐）**：Cloudflare Pages Git 集成，直接连 GitHub，push `main` 自动构建部署，PR 自动预览。最省心。
  - **B**：GitHub Actions + `cloudflare/wrangler-action`（`pages deploy`），适合需要在部署前跑复杂 CI 步骤时。
  - 二者只启用其一，防止双重触发。
- 静态资源（图片/动图/文档）走 Cloudflare CDN 缓存；HTML 设短缓存、带指纹的静态资源设长缓存。
- **定时重建**：为下载页动态版本，配置 Deploy Hook + GitHub Actions `schedule`（每日）触发（见 [06 §6.1](./06-implementation.md)）。

## 9.3 域名规划

- **前端站点**：使用唯一域名 **`video2text.dpdns.org`**（Cloudflare 托管，自带 SSL，无需 ICP 备案）。虽为免费动态 DNS 子域，存在一定风险（专业度、邮件、MoR 审核），但已接受并配合缓解措施（见 [01 §1.3.2](./01-background.md)、[11 §11.3](./11-tbd.md)）。
- **后端 API**：使用子域 **`api.video2text.dpdns.org`**（而非站点根路径 `/api`）：
  - 静态站点（Pages）与动态后端（VM/Cloud Run）是不同源站，用子域分流最清晰，避免在 Pages 上做复杂反代规则；
  - 前端通过 `PUBLIC_API_BASE=https://api.video2text.dpdns.org` 注入，后端配置 CORS 白名单仅允许站点域名；
  - `api.video2text.dpdns.org` 仍走 Cloudflare 橙色云代理（隐藏源站、WAF、限流）；在 Cloudflare DNS 为 `api` 添加 CNAME 指向 Cloudflare Tunnel（或后端源站）。

## 9.4 后端部署（后期，P3）

- **复用现有 GCP 机器**：已有一台 **Google Cloud e2-micro（2 vCPU / 1 GB 内存）**，足以承载低流量后端（License 校验 + Paddle Webhook，买断制 $9.9 交易频次极低）。P0–P2 阶段前端为纯静态（Cloudflare Pages），该机器暂不启用。后端对外通过 `api.video2text.dpdns.org`（Cloudflare Tunnel / Caddy 反代）暴露。
- **注意 Always Free 限制**：GCP e2-micro 免费额度限定在**特定美国区域**（us-west1/us-central1/us-east1）且**每账号每月 1 台**；若该机已跑其他服务，需评估 1 GB 内存是否够用（Docker + uvicorn + SQLite 需精简，必要时加 swap）。
- 形态：Python FastAPI + Docker，部署于该 GCP e2-micro；保持精简（uvicorn 单/少 worker + SQLite，不引重型依赖）。
- 反向代理/TLS：VM 上用 Caddy/Nginx 处理本地 TLS 与转发（或仅监听内网，由 Cloudflare Tunnel 暴露，免公网端口与证书维护）。
- 备选：若内存吃紧或想省运维，改用 **Cloud Run**（serverless，缩容到 0）。**注意**：Cloud Run 无持久磁盘，**不能用 SQLite 文件**，需搭配托管数据库（Cloud SQL / Neon / Supabase Postgres）。
- 密钥管理：后端 `.env`（Paddle 密钥、Webhook 密钥、JWT 密钥、Ed25519 私钥、DB 连接、邮件服务 Key）仅存部署环境，经 Actions Secrets / 平台环境变量注入，永不进仓库。
- **数据库与备份**：
  - 起步 SQLite（文件，位于持久磁盘）；**必须**配置定期备份（如每日导出上传对象存储），否则 VM 故障即丢订单/License 数据；
  - 生产可迁移 Postgres（Neon/Supabase/Cloud SQL）；用 Alembic 管理 schema。
  - 备选 Cloudflare D1 需注意其为 SQLite 兼容但接口/驱动不同，SQLAlchemy 支持有限，选型前验证。

## 9.5 CI/CD 要点

| 项 | 说明 |
| --- | --- |
| 前端 CI | `astro check` + lint + build + 死链检查 + Lighthouse CI + 部署 Cloudflare Pages |
| 后端 CI（后期） | pytest（含 Webhook 验签/License 状态机）+ 构建镜像 + 部署 |
| Secrets | `CLOUDFLARE_API_TOKEN`、`PADDLE_API_KEY`、`PADDLE_WEBHOOK_SECRET`、`JWT_SECRET`、`LICENSE_ED25519_PRIVATE_KEY`、`DB_URL`、`MAIL_API_KEY` 等 |
| 预览 | PR 预览前端；后端可 staging 环境（独立 DB） |
| 回滚 | Cloudflare Pages 一键回滚；后端镜像版本回滚 + 迁移可回退 |
| 监控 | 后端 `/health` + Uptime 探针；错误日志与告警（邮件/webhook） |

## 9.6 安全与合规

- 前端零密钥；所有付费/授权敏感逻辑后端完成
- Cloudflare 开启 WAF / Bot 防护 / 速率限制，保护 `api.video2text.dpdns.org` 与后期 `/checkout`
- Paddle Webhook 强制验签 + 幂等；仅信任 Paddle 官方来源
- Paddle 处理全球 VAT/税务与开票，降低合规负担
- 隐私政策 `/privacy` + 服务条款 `/terms` + 退款政策 `/refund` 齐备
- 明确「桌面端本地离线、不上传音视频；在线模型/BYOK 除外」

## 9.7 内容维护说明

- `video2text-web` 为**独立仓库**，文档/博客原生维护于本站，不引用、不同步外部仓库（见 [06 §6.4](./06-implementation.md)）。
- 下载页的应用版本来自 `PUBLIC_RELEASE_REPO` 配置的分发仓库（内容配置，非代码耦合）；版本刷新由定时重建保证（见 §9.2），不依赖任何外部仓库事件。
