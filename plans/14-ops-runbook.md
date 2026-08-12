# 14 · 本地测试 / 部署 / 发布 / 上线 详细手册

> 模块定位：在 [09-deployment.md](./09-deployment.md) 架构之上，给出**编码完成后**从本地验证到正式上线的逐步可执行手册（命令、清单、回滚）。
> 上级索引：[00-overview.md](./00-overview.md)
> 适用：P1 静态站点上线、P3 后端上线；含日常发布与应急回滚。
> 前置：已完成 [13-code-design-detail.md](./13-code-design-detail.md) 的编码。

> **项目独立性（重要）**：`video2text-web` 是**独立项目**，与桌面端 `video2text` 在代码、仓库、版本、配置上**完全解耦**——不引用桌面端源码/版本号/Release，不依赖桌面端仓库触发构建。本站（/changelog 等）指向的应用分发仓库、文档来源等均为**可配置内容项**（经 `PUBLIC_*`/env 注入），并非代码耦合。本手册所有命令默认在本项目根目录执行。

---

## 14.0 总览流程

```
本地开发 → 本地验证(14.1/14.2) → 提交 PR(14.4) → CI(14.3) → 合并 main
   → 前端自动部署 Cloudflare Pages(14.5) / 后端部署 GCP(14.6)
   → 线上冒烟(14.7) → 发布说明/打 tag(14.8) → 上线后监控(14.9)
```

---

## 14.1 本地测试（前端）

### 14.1.1 环境准备

> **运行环境变更（重要）**：本文档早期按 **Windows + PowerShell 7 + 全局 Node v24.14.0** 编写。当前开发已迁移到 **WSL / Ubuntu 26.04 LTS**。下方同时给出 **WSL/Ubuntu（现行）** 与 **Windows（历史）** 两套准备步骤；CI 与 Cloudflare Pages 始终在 Linux（ubuntu-latest）上构建，与本地前端开发环境解耦。

#### 14.1.1.1 环境基线检查（WSL / Ubuntu）

迁移后实测工具链状态（见 [README.md](./README.md) 的 Prerequisites 表）：

| 工具              | 要求                              | 本机状态                                                                                    |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| Node.js           | `>=24`（`.nvmrc` 固定 `24.14.0`） | ❌ **未安装**（仅有 `/mnt/c/dev/nodejs/node.exe` 的 Windows 二进制，无法在 WSL/Linux 运行） |
| npm               | `>=10`（随 Node 提供）            | ❌ 未安装（仅 `/mnt/c/dev/nodejs/npm` 的 Windows 符号链接，Linux 下不可用）                 |
| nvm / fnm / volta | Node 版本管理                     | ❌ 未安装                                                                                   |
| Python 3          | `>=3.10`（`npm run icons` 用）    | ✅ 3.14.4                                                                                   |
| pip               | 安装 Pillow                       | ❌ 未安装（`python3 -m pip` 缺失）                                                          |
| Pillow (PIL)      | `scripts/generate_icon.py` 依赖   | ❌ 未安装                                                                                   |
| Git               | 任意新版                          | ✅ 2.53.0                                                                                   |

> ⚠️ Windows 侧 `node.exe v24.14.0` **不能在 WSL/Linux 下执行**，必须在 Linux 环境内原生安装 Node，否则 `npm ci` / `astro` 均无法运行。

#### 14.1.1.2 WSL / Ubuntu 准备（现行）

```bash
# 1) 安装 Node 24（推荐 nvm，与 .nvmrc 一致）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 24.14.0
nvm use 24.14.0            # 与 .nvmrc 对齐

# 2) 图标脚本依赖：Pillow（先装 pip）
sudo apt update && sudo apt install -y python3-pip
python3 -m pip install --user Pillow

# 3) 安装依赖 & 本地环境
node -v                   # v24.14.0
npm -v                    # >= 10
npm ci                    # 锁版本安装（CI 同款）
cp .env.example .env      # 仅 PUBLIC_* 变量；无密钥
```

- `.nvmrc` 固定 `24.14.0`，`package.json` 的 `engines.node` 设为 `">=24"`；Cloudflare Pages 构建变量 `NODE_VERSION=24.14.0`（见 14.5）。
- `.env` 仅含 `PUBLIC_*` 公共变量，**无密钥**。
- 后端（P3）Python 环境用 **conda** 管理，环境名固定 **`video2text-web`**，准备步骤见 [14.1.7](#1417-本地-python-环境conda-backend-p3)。

#### 14.1.1.3 Windows 准备（历史 / 仅参考）

> 仅适用于仍在使用 Windows 物理机的协作者；当前主开发环境为 WSL/Ubuntu（见 14.1.1.2）。

- 本机已安装 **Node v24.14.0**（全局），终端为 **PowerShell 7（pwsh）**；命令示例均按 pwsh 给出。
- 若使用 [nvm-windows](https://github.com/coreybutler/nvm-windows) 管理多版本：`nvm use 24.14.0`；否则直接用系统 Node（版本已满足）即可。

```powershell
node -v                                  # v24.14.0
npm -v                                   # 建议 >= 10
npm ci                                   # 锁版本安装（CI 同款）
Copy-Item .env.example .env              # 仅 PUBLIC_* 变量；无密钥
```

### 14.1.2 开发预览

```powershell
npm run dev        # http://localhost:4321 ；验证 /en /zh 切换、菜单
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
    { "label": "web:check", "type": "shell", "command": "npm run check", "problemMatcher": [] },
    { "label": "web:build", "type": "shell", "command": "npm run build", "problemMatcher": [] },
    { "label": "web:lint", "type": "shell", "command": "npm run lint", "problemMatcher": [] },
    {
      "label": "api:test",
      "type": "shell",
      "command": "cd backend && pytest -q",
      "problemMatcher": []
    },
    {
      "label": "api:serve",
      "type": "shell",
      "command": "cd backend && uvicorn app.main:create_app --factory --port 8000",
      "problemMatcher": []
    }
  ]
}
```

`.vscode/launch.json`（前端 dev server + 后端 attach）：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Web: dev",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "API: uvicorn",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:create_app", "--factory", "--reload", "--port", "8000"],
      "cwd": "${workspaceFolder}/backend",
      "envFile": "${workspaceFolder}/backend/.env"
    }
  ],
  "compounds": [{ "name": "Web + API", "configurations": ["Web: dev", "API: uvicorn"] }]
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

### 定时重建（/changelog 版本日志）

- Cloudflare Pages → Deploy Hooks → 新建 `nightly`，得到 URL。
- GitHub Actions `schedule`（每日 03:00 UTC）`curl` 该 URL 触发重建，保证 /changelog 版本日志新鲜。
- 验证：`Invoke-WebRequest -Method Head https://video2text.dpdns.org/en/changelog` 看 `cf-cache-status` 与最新版本号。

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
> 本文档路径以实测环境 `/home/ubuntu/video2text-web` 为准（克隆到哪就在哪，compose 内统一用相对路径 `./.env` / `./data`）。

- 机器：`us-west1/us-central1/us-east1` 的 e2-micro（Always Free 区域，[09 §9.4](./09-deployment.md)）。
- 注意 Always Free 限制：限定在**特定美国区域**且**每账号每月 1 台**；若该机已跑其他服务，需评估 1 GB 内存是否够用（Docker + uvicorn + SQLite 需精简，**务必加 swap**）。
- 形态：Python FastAPI + Docker，部署于该 GCP e2-micro；保持精简（uvicorn 单/少 worker + SQLite，不引重型依赖）。
- 反向代理/TLS：**VM 上用 Caddy 终止 443 并反代到 `127.0.0.1:8000`**（本会话实测方案）。未采用 Cloudflare Tunnel。Caddy 自动申请/续期 Let's Encrypt 证书。
- 备选：若内存吃紧或想省运维，改用 **Cloud Run**（serverless，缩容到 0）。**注意**：Cloud Run 无持久磁盘，**不能用 SQLite 文件**，需搭配托管数据库（Cloud SQL / Neon / Supabase Postgres）。
- 密钥管理：后端 `backend/.env` 仅存于 VM，权限 `600`；**绝不进仓库**（见下方「关键坑位」）。

#### 阶段 0 — 建机（一次性）

- 区域选 `us-west1` / `us-central1` / `us-east1` 之一（Always Free 限定）。
- 机型 `e2-micro`（2 vCPU 共享 / 1 GB），启动盘 30 GB 标准 PD（免费额度内）。
- 系统镜像：Ubuntu 24.04 LTS。
- 防火墙：放通入站 `22`（SSH）、`80`、`443`（Let's Encrypt http-01 验证与 TLS 都需）。不开也行，但 Caddy 申请证书时必须 80/443 可达。

#### 阶段 1 — 基础环境 + Docker

```bash
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y ca-certificates curl git
# Docker 官方源
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
# 将当前用户加入 docker 组（需重登录或 newgrp；WSL/受限 shell 下直接用 sudo 也行）
sudo usermod -aG docker $USER
```

> 若 `docker` 命令报 `permission denied`，统一加 `sudo` 前缀（本会话实测 VM 账号不在 docker 组，全部用 `sudo docker compose ...`）。

#### 阶段 2 — 内存兜底（e2-micro 1GB，必做）

```bash
sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#### 阶段 3 — 拉代码 + 建生产 .env（关键，易漏）

```bash
sudo mkdir -p /home/ubuntu/video2text-web && sudo chown $USER:$USER /home/ubuntu/video2text-web
git clone https://github.com/fuyouling/video2text-web /home/ubuntu/video2text-web
cd /home/ubuntu/video2text-web
```

> `.env` **不进 Git**（密钥永不入库）。`git pull` 后服务器只有 `backend/.env.example`，**必须本地重建 `backend/.env`**：
>
> - 若之前已在服务器建好 `.env` 且被重新 `git pull` 覆盖成模板，需按下方重建并填真实密钥，否则 pydantic 校验 `JWT_SECRET` 等必填项会启动失败。
> - 确认未被 Git 跟踪（防密钥泄露）：`git check-ignore backend/.env && echo IGNORED || echo TRACKED`；若显示 `TRACKED`，立即 `git rm --cached backend/.env` 并加进 `.gitignore` 后提交。

```bash
cd /home/ubuntu/video2text-web/backend
cp .env.example .env
chmod 600 .env
nano .env   # 改 APP_ENV=production；填入真实 JWT_SECRET / LICENSE_ED25519_PRIVATE_KEY / PADDLE_* / MAIL_API_KEY
```

生成真实密钥（**切勿用 .env.example 的测试值**）：

```bash
python3 -c "import secrets;print('JWT_SECRET='+secrets.token_hex(32))"
python3 -c "import base64,os;print('LICENSE_ED25519_PRIVATE_KEY='+base64.b64encode(os.urandom(32)).decode())"
```

`backend/.env` 要点：

- `DB_URL=sqlite:////data/app.db`（**绝对路径**，指向挂载卷 `/data`，否则数据落到容器可写层、重建即丢）。
- `APP_ENV=production`（compose 也会用 `environment` 覆盖，双重保险）。

#### 阶段 4 — docker-compose 实测配置（backend/docker-compose.yml）

> 关键坑位：应用 `app/core/config.py` 的 `Settings` 用 pydantic-settings，`env_file=".env"` 是**相对 WORKDIR `/app`** 解析，而 `.env` 被 `.dockerignore` 排除、不进镜像、也不挂载 → 容器内读不到 `.env`，仅拿到 compose `environment` 注入的 `DB_URL`，启动报 `JWT_SECRET ... missing`。
> **修复**：把宿主机 `./.env` 挂载进容器 `/app/.env`（`:ro`），pydantic 即可读到；同时 compose `env_file` 也注入进程环境，双保险。

```yaml
services:
  api:
    build: .
    image: video2text-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000" # 仅监听回环，由 Caddy 反代；不直暴露公网
    env_file:
      - ./.env
    environment:
      - APP_ENV=production
      - DB_URL=sqlite:////data/app.db
    volumes:
      - ./data:/data # SQLite 持久化（宿主机 backend/data）
      - ./.env:/app/.env:ro # 让容器内 pydantic 读到 .env
    deploy:
      resources:
        limits:
          memory: 512M # e2-micro 1GB，封顶防 OOM 拖垮宿主机
    command:
      [
        "sh",
        "-c",
        "alembic upgrade head && uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000",
      ]
```

#### 阶段 5 — Caddy 反代 + TLS（替代 Cloudflare Tunnel）

```bash
# Caddy 2.6.2（Ubuntu 仓库版即可；dl.cloudflare.com 在 GCP 部分区域不可达，勿用其源）
sudo apt-get install -y caddy

sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
api.video2text.dpdns.org {
    encode gzip
    reverse_proxy 127.0.0.1:8000
}
EOF
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

证书获取与 Cloudflare 模式（实测结论）：

- **Cloudflare 橙云（Proxied）**：`api` 记录解析到 Cloudflare IP，用户侧 TLS 由 Cloudflare 证书提供，`curl https://api...` 直接返回 200，**无需 Caddy 自己拿到证书**。但 Caddy 的 Let's Encrypt `tls-alpn-01` 挑战会被 Cloudflare 拦截（日志刷 `acme-tls/1` 403），属预期，非故障。
  - 若要消除 Caddy 报错：把 Caddyfile 改成仅监听 `:80`（Cloudflare SSL 模式设 `Flexible`，CF↔源站明文回源），或改用「灰云 + Caddy 真实证书」。
- **Cloudflare 灰云（DNS only）**：`api` A 记录直连 VM 公网 IP，Caddy 正常 http-01/tls-alpn-01 拿到 Let's Encrypt 真实证书，不再报错。
- 无论哪种，都需 GCP 防火墙放通 `80`/`443` 入站，且 `api.video2text.dpdns.org` 的 DNS 记录**已存在且生效**（Caddy 首次签发报 `NXDOMAIN` 即因记录未建，先 `dig +short api.video2text.dpdns.org` 确认解析到本机/Cloudflare）。

#### 阶段 6 — 启动后端 + 验证

```bash
cd /home/ubuntu/video2text-web/backend
sudo docker compose up -d          # 已存在则重建/重启；自动 alembic upgrade head 后起 uvicorn
sleep 4
sudo docker compose ps             # 状态 Up，端口 127.0.0.1:8000->8000/tcp
sudo docker compose logs --tail 20 # 应无 missing 报错
curl -s http://127.0.0.1:8000/health          # 期望 {"status":"ok"}
curl -sI https://api.video2text.dpdns.org/health   # 经 Caddy/Cloudflare 443
sudo systemctl restart caddy       # DNS 刚生效后，重启让 Caddy 重新申请证书
```

> 容器名由 compose 项目名决定（目录名 `backend` → `backend-api-1`），不是 `video2text-api`。

#### 阶段 7 — 每日备份（防 VM 故障丢订单）

```bash
# /etc/cron.d/backup-db
0 4 * * * root docker compose -f /home/ubuntu/video2text-web/backend/docker-compose.yml exec -T api sqlite3 /data/app.db .dump > /home/ubuntu/video2text-web/backup/app-$(date +\%F).sql && \
  rclone copy /home/ubuntu/video2text-web/backup/app-$(date +\%F).sql r2:video2text-backup/db/   # 或 gsutil cp ... gs://video2text-backup/db/
```

#### 阶段 8 — 更新流程

```bash
cd /home/ubuntu/video2text-web && git pull   # .env 不会被覆盖（已在 .gitignore）
cd backend && sudo docker compose up -d      # 重建镜像并重启；.env 挂载仍生效
```

#### 关键坑位速查（本会话实测）

| 现象                                      | 原因                                                 | 修复                                                      |
| ----------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| 启动报 `JWT_SECRET ... missing`           | pydantic `env_file=".env"` 相对 `/app`，容器内读不到 | 挂载 `./.env:/app/.env:ro`                                |
| `docker: permission denied`               | 用户不在 docker 组                                   | 全部命令加 `sudo`，或 `usermod -aG docker $USER` 后重登录 |
| Caddy 起不来 `:80 address already in use` | 80 被 nginx 占用                                     | 停掉/禁用 nginx，让 Caddy 独占 80/443                     |
| Caddy 证书 `NXDOMAIN`                     | `api` DNS 记录未建                                   | Cloudflare 建 A 记录指向 VM IP，生效后 `restart caddy`    |
| Caddy `tls-alpn-01` 403                   | Cloudflare 橙云拦截挑战                              | 预期；改 Caddy 只跑 `:80`+CF Flexible，或改灰云           |
| `env file .../.env not found`             | compose 绝对路径与服务器实际路径不符                 | 统一用相对路径 `./.env` / `./data`                        |
| 重新 `git pull` 后后端密钥变模板          | `.env` 被覆盖成 `.env.example`                       | 重建 `backend/.env` 并填真实密钥；确认 `.gitignore`       |

### 14.6.3 数据库与迁移（生产）

```bash
cd /home/ubuntu/video2text-web/backend
sudo docker compose exec api alembic upgrade head     # 首次建表（compose command 已自动跑，手动补跑亦可）
# 备份（每日 cron，见 14.6.2 阶段 7；VM 需预装 sqlite3 CLI 或改用 python -c 导出）：
#   sudo docker compose exec -T api sqlite3 /data/app.db .dump > /backup/app-$(date +%F).sql
# 上传对象存储（二选一，凭证经环境变量注入）：
#   rclone copy /backup/app-$(date +%F).sql r2:video2text-backup/db/
#   gsutil cp /backup/app-$(date +%F).sql gs://video2text-backup/db/
# 恢复演练（至少一次）：
#   sudo docker compose exec -i api sqlite3 /data/app.db < /backup/app-<date>.sql
```

### 14.6.4 域名与 CORS

- 子域 `api.video2text.dpdns.org` → Cloudflare（橙云或灰云）→ Caddy 反代 → `127.0.0.1:8000`。
- 后端 `settings.frontend_origins` 仅含站点域名；CORS 白名单生效（[13 §13.9 core/config](./13-code-design-detail.md)）。
- 开启 Cloudflare WAF / Rate Limiting 保护 `api.video2text.dpdns.org`。

### 14.6.5 密钥注入

- `backend/.env` 仅存于 VM，权限 `600`；经 Actions Secrets / 平台变量注入，**永不进仓库**（见 14.6.2 阶段 3 的 `git check-ignore` 校验）。
- 轮换：Paddle / JWT / Ed25519 私钥轮换流程需事先定义，且不影响已签发 License（公钥内置于桌面端，换钥需桌面端发版）。
- 切忌把 `.env.example` 的测试值当生产密钥使用。

---

## 14.7 线上冒烟（Go-Live 前必做）

前端：

- [ ] `/`、`/en`、`/zh` 均可访问；`/` 301 → `/en`
- [ ] 每页 `view-source` 确认 canonical / hreflang（en↔zh + x-default）正确
- [ ] `sitemap-index.xml`、`robots.txt` 存在且放行
- [ ] OG/JSON-LD（`SoftwareApplication`）渲染正确
- [ ] /changelog 版本日志 = 最新 Release；下载 CTA 指向 GitHub Releases 正常
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

> `video2text-web` 使用**独立版本号** `web-vX.Y.Z`（与桌面端 `video2text` 的 `APP_VERSION` 无关）。/changelog 版本日志来自 `PUBLIC_RELEASE_REPO` 配置的分发仓库，由构建期注入，与本站自身版本解耦（见 [06 §6.1](./06-implementation.md)）。

```powershell
步骤 1：暂存所有更改

git add -A

步骤 2：提交更改

git commit -m "Release v1.1"

步骤 3：创建 tag

git tag -a v1.1 -m "Release v1.1"

步骤 4：推送 commit 和 tag 到远程

git push origin main
git push origin v1.1

```

- /changelog 版本刷新：由 Cloudflare Deploy Hook / 定时重建触发（见 14.5），**不**依赖桌面端仓库事件。
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

- /changelog Release API 失败：页面兜底已构建版本日志 + 「查看所有版本」链接（[06 §6.1](./06-implementation.md)）。
- 私钥/密钥泄露：立即在 Paddle / 平台轮换，撤销相关 License 并邮件通知，旧 key 失效需桌面端发版。
- 单 VM 故障：凭每日备份在备用镜像快速重建（[10 §10.6](./10-risks.md)）。

---

## 14.10 阶段上线清单（速查）

| 阶段 | 关键动作                                               | 退出标准                              |
| ---- | ------------------------------------------------------ | ------------------------------------- |
| P1   | Pages 部署 `/en`、`/zh` 静态站；死链+Lighthouse 通过   | 公网可访问，SEO 基础达标              |
| P2   | SEO 全量、Release 动态版本、双语内容、域名固定稳定运营 | Search Console 收录，下载指向真实资产 |
| P3   | GCP 后端 + Paddle Webhook + License 签发/邮件          | sandbox 全链路跑通，幂等/退款验证     |
| P4   | 支付宝回调 + `/account` 自助换机                       | 全渠道收款可用                        |

---

> 本手册与 [09-deployment.md](./09-deployment.md)（架构）、[13-code-design-detail.md](./13-code-design-detail.md)（编码依据）配套。任何部署偏差回写本文件。
