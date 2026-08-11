# 14 · 本地测试 / 部署 / 发布 / 上线 详细手册

> 模块定位：在 [09-deployment.md](./09-deployment.md) 架构之上，给出**编码完成后**从本地验证到正式上线的逐步可执行手册（命令、清单、回滚）。
> 上级索引：[00-overview.md](./00-overview.md)
> 适用：P1 静态站点上线、P3 后端上线；含日常发布与应急回滚。
> 前置：已完成 [13-code-design-detail.md](./13-code-design-detail.md) 的编码。

> **项目独立性（重要）**：`video2text-web` 是**独立项目**，与桌面端 `video2text` 在代码、仓库、版本、配置上**完全解耦**——不引用桌面端源码/版本号/Release，不依赖桌面端仓库触发构建。本站下载页指向的应用分发仓库、文档来源等均为**可配置内容项**（经 `PUBLIC_*`/env 注入），并非代码耦合。本手册所有命令默认在本项目根目录执行。

---

## 14.0 总览流程

```
本地开发 → 本地验证(14.1/14.2) → 提交 PR(14.4) → CI(14.3) → 合并 main
   → 前端自动部署 Cloudflare Pages(14.5) / 后端部署 GCP(14.6)
   → 线上冒烟(14.7) → 发布说明/打 tag(14.8) → 上线后监控(14.9)
```

---

## 14.1 本地测试（前端）

### 14.1.1 环境准备（Windows + Node v24.14.0）

- 本机已安装 **Node v24.14.0**（全局），终端为 **PowerShell 7（pwsh）**；命令示例均按 pwsh 给出。
- `.nvmrc` 固定 `24.14.0`，`package.json` 的 `engines.node` 设为 `">=24"`；Cloudflare Pages 构建变量 `NODE_VERSION=24.14.0`（见 14.5）。
- 若使用 [nvm-windows](https://github.com/coreybutler/nvm-windows) 管理多版本：`nvm use 24.14.0`；否则直接用系统 Node（版本已满足）即可。
- `.env` 仅含 `PUBLIC_*` 公共变量，**无密钥**。
- 后端（P3）Python 环境用 **conda** 管理，环境名固定 **`video2text-web`**，准备步骤见 [14.1.7](#1417-本地-python-环境conda-backend-p3)。

```powershell
node -v                                  # v24.14.0
npm -v                                   # 建议 >= 10
npm ci                                   # 锁版本安装（CI 同款）
Copy-Item .env.example .env              # 仅 PUBLIC_* 变量；无密钥
```

### 14.1.2 开发预览

```powershell
npm run dev        # http://localhost:4321 ；验证 /en /zh 切换、下载页、菜单
```

### 14.1.3 静态校验（质量门槛）

```powershell
python scripts/generate_icon.py   # 用 Pillow 生成 favicon/OG/Logo/占位图到 public/（见 13 §13.12）
npm run check      # astro check + tsc --noEmit（类型/语法）
npm run lint       # eslint + prettier --check
npm run build      # 产物输出 ./dist
npm run preview    # 本地起 dist，模拟线上（含 / -> /en 重定向）
```

### 14.1.4 死链与性能（CI 同款，可选本地跑）

```powershell
# 死链（对 build 产物）
npx linkinator ./dist --recurse --silent
# 或 lychee ./dist
# Lighthouse（需 Chrome）
npx unlighthouse --site http://localhost:4321/en   # 目标 Perf≥95 / SEO=100 / A11y≥95
```

### 14.1.5 文档维护说明（本站独立）

> 本站文档原生维护于 `src/content`（见 [06 §6.4](./06-implementation.md)），**不提供任何外部仓库同步脚本**（不存在 `npm run sync:docs` / `scripts/sync-docs.mjs`）。如需复用既有资料，人工整理后落地即可。

### 14.1.6 VSCode 工程化配置

> 编辑器：**Visual Studio Code**（VSCode）。下列 `.vscode/` 配置文件建议提交进仓库（见下方 gitignore 例外），保证团队与 CI 行为一致。

**A. 推荐扩展 `settings.json`（仅 workspace 建议，不强制）**

`.vscode/extensions.json`：

```json
{
  "recommendations": [
    "astro-build.astro-vscode",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-python.python",
    "ms-python.vscode-pylance",
    "charliermarsh.ruff",
    "ms-azuretools.vscode-docker"
  ]
}
```

**B. 工作区设置 `.vscode/settings.json`**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "prettier.documentSelectors": ["**/*.astro"],
  "[astro]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "files.associations": { "*.astro": "astro" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "python.defaultInterpreterPath": "/home/<user>/miniforge3/envs/video2text-web/bin/python",
  // Remote - SSH 下指向 Ubuntu conda 环境；将 <user> 替换为实际用户名；Windows 本地前端开发可忽略
  "python.testing.pytestEnabled": true,
  "python.testing.pytestPath": "${workspaceFolder}/backend",
  "files.exclude": { "**/.astro": true, "**/dist": true }
}
```

**C. 调试 `tasks.json` + `launch.json`**

`.vscode/tasks.json`（前端构建校验 / 后端测试一键任务）：

```json
{
  "version": "2.0.0",
  "tasks": [
    { "label": "web:check",  "type": "shell", "command": "npm run check",  "problemMatcher": [] },
    { "label": "web:build",  "type": "shell", "command": "npm run build",  "problemMatcher": [] },
    { "label": "web:lint",   "type": "shell", "command": "npm run lint",   "problemMatcher": [] },
    { "label": "api:test",   "type": "shell", "command": "cd backend && pytest -q", "problemMatcher": [] },
    { "label": "api:serve",  "type": "shell", "command": "cd backend && uvicorn app.main:create_app --factory --port 8000", "problemMatcher": [] }
  ]
}
```

`.vscode/launch.json`（前端 dev server + 后端 attach）：

```json
{
  "version": "0.2.0",
  "configurations": [
    { "name": "Web: dev", "type": "node-terminal", "request": "launch",
      "command": "npm run dev", "cwd": "${workspaceFolder}" },
    { "name": "API: uvicorn", "type": "python", "request": "launch",
      "module": "uvicorn", "args": ["app.main:create_app", "--factory", "--reload", "--port", "8000"],
      "cwd": "${workspaceFolder}/backend", "envFile": "${workspaceFolder}/backend/.env" }
  ],
  "compounds": [
    { "name": "Web + API", "configurations": ["Web: dev", "API: uvicorn"] }
  ]
}
```

**D. gitignore 例外（让 `.vscode` 配置可提交）**

当前 `.gitignore` 末尾忽略了 `.vscode`。为共享工程化配置，在 `.gitignore` 末尾追加白名单（仅提交配置，忽略本地状态）：

```gitignore
# 提交 VSCode 工程化配置（忽略本地状态）
!.vscode/
!.vscode/extensions.json
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
.vscode/*.log
```

> 说明：前端为纯静态 Astro，IDE 配置不影响构建产物；后端 VSCode 配置仅作用于本地开发体验，不进生产镜像。

---

### 14.1.7 本地 Python 环境（conda，backend P3）

- 后端（P3）使用 **conda** 管理 Python 环境，环境名固定为 **`video2text-web`**（Ubuntu 上已创建；与桌面端 `video2text` 环境区分）。
- **开发方式**：Windows + VSCode Remote - SSH 连接 Ubuntu；终端即 Ubuntu 终端，直接操作 conda 环境，**无需 Docker Desktop**。前端（Astro）继续在 Windows 本地开发。
- 后端 `.env`（密钥）仅在 Ubuntu 本地创建，权限受限，**绝不**进仓库（见 14.2）。

```bash
# 在 VSCode Remote 终端（Ubuntu）中执行
conda activate video2text-web
python -m pip install -r backend/requirements.txt
```

- VSCode Remote 会自动检测 conda 环境；`python.defaultInterpreterPath` 指向 Ubuntu 环境路径（如 `/home/<user>/miniforge3/envs/video2text-web/bin/python`），见 [14.1.6](#1416-vscode-工程化配置)。

---

## 14.2 本地测试（后端，P3）

> 前置：已完成 [14.1.7](#1417-本地-python-环境conda-backend-p3) 的 conda 环境 `video2text-web`（Ubuntu via VSCode Remote）。

```bash
# 首次或变更时
cd backend
pip install -r requirements.txt

# 本地起服务
uvicorn app.main:create_app --factory --reload --port 8000
```

```bash
# 单元/集成测试（pytest；Webhook 验签、License 状态机必过）
pytest -q

# 冒烟
curl http://localhost:8000/health
curl -X POST http://localhost:8000/license/activate \
  -H 'content-type: application/json' \
  -d '{"key":"V2T-PRO-TEST-0000-0000","machine_id_hash":"abc"}'
```

> 红线：`.env` 真实值**绝不**提交；本地测试用 sandbox Paddle 与测试 License 密钥。

---

## 14.3 CI（GitHub Actions，`.github/workflows/ci.yml`）

前端（每次 push / PR）：

- `npm ci`
- `npm run check` + `npm run lint`
- `npm run build`
- 死链检查（linkinator 对 `dist`）
- Lighthouse CI（PR 上注释分数；低于阈值失败）
- 预览部署（Cloudflare Pages PR 预览 / 或 wrangler preview）

后端（P3，`.github/workflows/backend.yml`，`backend/**` 改动触发）：

- `pip install -r backend/requirements.txt`
- `pytest -q`
- `docker build -t video2text-api backend/` 构建镜像验证

> Secrets（仓库 Settings → Secrets）：`CLOUDFLARE_API_TOKEN`、`PADDLE_API_KEY`、`PADDLE_WEBHOOK_SECRET`、`JWT_SECRET`、`LICENSE_ED25519_PRIVATE_KEY`、`DB_URL`、`MAIL_API_KEY`。CI 日志**不得**打印这些变量。

---

## 14.4 提交与合并约定

- 分支：`main`（生产，保护）+ `dev` + `feat/*` PR。
- `main` 保护：CI 必过 + 至少 1 review（可自评）；禁止直推。
- Commit 风格：约定式（`feat:`/`fix:`/`docs:`/`chore:`），便于自动 changelog。
- 合并后触发部署（见 14.5 / 14.6）。

---

## 14.5 前端部署：Cloudflare Pages（A 方案，推荐）

> 二选一，避免与 B 方案重复触发（[09 §9.2](./09-deployment.md)）。

### 首次接入（Git 集成）

1. Cloudflare Dashboard → Pages → Connect to Git → 选 `video2text-web` 仓库。
2. 构建配置：
   - 生产分支：`main`
   - 构建命令：`npm ci && npm run build`
   - 输出目录：`dist`
   - 环境变量：`NODE_VERSION=24.14.0`（与 `.nvmrc` 一致）、`PUBLIC_SITE`、`PUBLIC_API_BASE`、`PUBLIC_RELEASE_REPO`（均为 `PUBLIC_*`，公开安全）
3. 保存 → 首次部署自动触发；PR 自动生成预览环境。

### 域名（固定使用 `video2text.dpdns.org`）

- `video2text.dpdns.org` 由 Cloudflare 托管，自带 Universal SSL；无需购买独立域名，也无 ICP 备案需求。
- Pages 直接使用 `video2text.dpdns.org` 作为站点域名；如需 `www` 可加 CNAME 重定向到 apex。
- SSL：开启「Always Use HTTPS」「Automatic HTTPS Rewrites」。
- `astro.config.mjs` 的 `site` 固定为 `https://video2text.dpdns.org`（或通过 `PUBLIC_SITE` 注入，默认值不变）。
- 无域名切换，避免 301 权重损失。

### 定时重建（下载页动态版本）

- Cloudflare Pages → Deploy Hooks → 新建 `nightly`，得到 URL。
- GitHub Actions `schedule`（每日 03:00 UTC）`curl` 该 URL 触发重建，保证下载页版本新鲜。
- 验证：`Invoke-WebRequest -Method Head https://video2text.dpdns.org/en/download` 看 `cf-cache-status` 与最新版本号。

> B 方案（GitHub Actions + `cloudflare/wrangler-action` pages deploy）仅在需复杂前置 CI 时启用；二者只开其一。

---

## 14.6 后端开发与部署

### 14.6.1 本地开发（Windows + VSCode Remote → Ubuntu）

> 开发在 Ubuntu 上进行，Windows 仅作为 VSCode Remote 客户端。Docker **不用于本地开发**，仅用于生产部署。

- 环境：Ubuntu（通过 VSCode Remote - SSH），conda 环境 `video2text-web`
- 数据：SQLite 文件位于 Ubuntu 项目目录 `backend/data/`（与代码同仓，不进版本控制）
- 启动：

```bash
conda activate video2text-web
cd backend
uvicorn app.main:create_app --factory --reload --port 8000
```

- 调试：VSCode Remote 直接 attach 到 uvicorn 进程（launch.json 见 14.1.6）
- 迁移：
```bash
cd backend
alembic upgrade head
```
- 备份（本地开发）：
```bash
sqlite3 backend/data/app.db ".dump" > backup/app-$(date +%F).sql
```

### 14.6.2 生产部署（Ubuntu / GCP e2-micro）

> 生产使用 Docker + docker-compose，与开发环境解耦。开发环境不加 Docker，保持轻量。

- 机器：`us-west1/us-central1/us-east1` 的 e2-micro（Always Free 区域，[09 §9.4](./09-deployment.md)）。
- 注意 Always Free 限制：限定在**特定美国区域**且**每账号每月 1 台**；若该机已跑其他服务，需评估 1 GB 内存是否够用（Docker + uvicorn + SQLite 需精简，必要时加 swap）。
- 形态：Python FastAPI + Docker，部署于该 GCP e2-micro；保持精简（uvicorn 单/少 worker + SQLite，不引重型依赖）。
- 反向代理/TLS：VM 上用 Caddy/Nginx 处理本地 TLS 与转发（或仅监听内网，由 Cloudflare Tunnel 暴露，免公网端口与证书维护）。
- 备选：若内存吃紧或想省运维，改用 **Cloud Run**（serverless，缩容到 0）。**注意**：Cloud Run 无持久磁盘，**不能用 SQLite 文件**，需搭配托管数据库（Cloud SQL / Neon / Supabase Postgres）。
- 密钥管理：后端 `.env` 仅存于 VM，权限 `600`；经 Actions Secrets / 平台变量注入，永不进仓库。

```bash
# 在 Ubuntu VM 上
cd /opt/video2text-web/backend
docker build -t video2text-api .
docker run -d --name video2text-api -p 127.0.0.1:8000:8000 \
  --env-file /opt/video2text-web/.env \
  -v /opt/video2text-web/data:/data \
  video2text-api
```

### 14.6.3 数据库与迁移（生产）

```bash
docker exec video2text-api alembic upgrade head     # 首次建表
# 备份（每日 cron，VM 需预装 sqlite3 CLI 或改用 python -c 导出）：
#   docker exec video2text-api sqlite3 /data/app.db .dump > /backup/app-$(date +%F).sql
# 上传对象存储（二选一，凭证经环境变量注入）：
#   rclone copy /backup/app-$(date +%F).sql r2:video2text-backup/db/
#   gsutil cp /backup/app-$(date +%F).sql gs://video2text-backup/db/
# 恢复演练（至少一次）：
#   docker exec -i video2text-api sqlite3 /data/app.db < /backup/app-<date>.sql
```

### 14.6.4 域名与 CORS

- 子域 `api.video2text.dpdns.org` → Cloudflare 橙云 → Tunnel/源站。
- 后端 `settings.frontend_origins` 仅含站点域名；CORS 白名单生效（[13 §13.9 core/config](./13-code-design-detail.md)）。
- 开启 Cloudflare WAF / Rate Limiting 保护 `api.video2text.dpdns.org`。

### 14.6.5 密钥注入

- `/opt/video2text-web/.env` 仅存于 VM，权限 `600`；经 Actions Secrets / 平台变量注入，**永不进仓库**。
- 轮换：Paddle / JWT / Ed25519 私钥轮换流程需事先定义，且不影响已签发 License（公钥内置于桌面端，换钥需桌面端发版）。

---

## 14.7 线上冒烟（Go-Live 前必做）

前端：

- [ ] `/`、`/en`、`/zh` 均可访问；`/` 301 → `/en`
- [ ] 每页 `view-source` 确认 canonical / hreflang（en↔zh + x-default）正确
- [ ] `sitemap-index.xml`、`robots.txt` 存在且放行
- [ ] OG/JSON-LD（`SoftwareApplication`）渲染正确
- [ ] 下载页版本号 = 最新 Release；UA 检测在 Windows 正确推荐
- [ ] Lighthouse：Perf≥95 / SEO=100 / A11y≥95
- [ ] 移动端菜单、LangSwitch 同页跳转正常

后端（P3）：

- [ ] `/health` 返回 ok
- [ ] Paddle sandbox 发测试单 → Webhook 验签成功 → License 签发 → 邮件收到 key
- [ ] 重复投递同一 Webhook 仅处理一次（幂等）
- [ ] 退款 Webhook → License 置 `refunded` → 桌面端复核失效
- [ ] 未知/错误签名 Webhook 返回 401，不落库

---

## 14.8 发布与打 tag

> `video2text-web` 使用**独立版本号** `web-vX.Y.Z`（与桌面端 `video2text` 的 `APP_VERSION` 无关）。下载页展示的应用版本来自 `PUBLIC_RELEASE_REPO` 配置的分发仓库，由构建期注入，与本站自身版本解耦；下载页的兜底版本常量 `APP_VERSION`（本站自有，起始 `1.0`）同样与桌面端无关（见 [06 §6.1](./06-implementation.md)）。

```powershell
# 1) 更新 CHANGELOG.md（按 conventional commits 自动/手写）
# 2) 打 tag（本站独立版本）
git tag -a web-v1.0.0 -m "video2text-web 1.0.0: download page + i18n"
git push origin web-v1.0.0
# 3) GitHub Release 关联 tag，写发布说明（新页面/修复/SEO 变更）
# 4) 若后端：镜像 tag 同步（docker tag + push），迁移 alembic 已 applied
```

- 下载页版本刷新：由 Cloudflare Deploy Hook / 定时重建触发（见 14.5），**不**依赖桌面端仓库事件。
- 发布博客：每次发版写一篇 changelog 博客，制造更新信号（[12 §12.3](./12-content-seo.md)）。

---

## 14.9 上线后监控与回滚

### 监控

- 前端：Cloudflare Analytics / Web Analytics（无 Cookie）；Search Console + Bing Webmaster 验证收录。
- 后端：`/health` Uptime 探针（如 UptimeRobot）；错误日志告警（邮件/webhook）；SQLite 备份成功告警。
- 指标（P3+）：pricing→checkout 转化、付费数、退款率（[12 §12.6](./12-content-seo.md)）。

### 回滚

- 前端：Cloudflare Pages → 部署历史 → 「Revert to」一键回滚；或 `git revert` + 重新部署。
- 后端：保留上一镜像 tag，`docker run` 旧版；数据库迁移若不可逆需先评估（Alembic `downgrade` 演练）。
- Webhook 异常：暂停 Paddle 事件处理开关（env flag），人工补单，避免重复签发。

### 应急

- 下载页 Release API 失败：页面兜底已构建版本号 + 「查看所有版本」链接（[06 §6.1](./06-implementation.md)）。
- 私钥/密钥泄露：立即在 Paddle / 平台轮换，撤销相关 License 并邮件通知，旧 key 失效需桌面端发版。
- 单 VM 故障：凭每日备份在备用镜像快速重建（[10 §10.6](./10-risks.md)）。

---

## 14.10 阶段上线清单（速查）

| 阶段 | 关键动作 | 退出标准 |
| --- | --- | --- |
| P1 | Pages 部署 `/en`、`/zh` 静态站；死链+Lighthouse 通过 | 公网可访问，SEO 基础达标 |
| P2 | SEO 全量、Release 动态版本、双语内容、域名固定稳定运营 | Search Console 收录，下载指向真实资产 |
| P3 | GCP 后端 + Paddle Webhook + License 签发/邮件 | sandbox 全链路跑通，幂等/退款验证 |
| P4 | 支付宝回调 + `/account` 自助换机 | 全渠道收款可用 |

---

> 本手册与 [09-deployment.md](./09-deployment.md)（架构）、[13-code-design-detail.md](./13-code-design-detail.md)（编码依据）配套。任何部署偏差回写本文件。
