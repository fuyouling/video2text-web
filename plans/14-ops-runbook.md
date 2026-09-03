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
   → 前端自动部署 Cloudflare Pages(14.5) / 后端部署 Oracle Cloud(14.6)
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
- 后端（P3）直接使用**系统 Python** 运行（依赖装到用户目录，**不使用 venv / conda**），准备步骤见 [14.1.7](#1417-本地-python-环境系统-python-backend-p3)。

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
npm run preview    # 本地起 dist，模拟线上（directory + trailingSlash: "always"，所有 URL 直接命中）
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
    "charliermarsh.ruff"
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
  "python.defaultInterpreterPath": "/usr/bin/python3",
  // Remote - SSH 下指向 Ubuntu 的系统 Python；Windows 本地前端开发可忽略
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

> 说明：前端为纯静态 Astro，IDE 配置不影响构建产物；后端 VSCode 配置仅作用于本地开发体验，不进生产环境。

---

### 14.1.7 本地 Python 环境（系统 Python，backend P3）

- 后端（P3）**直接使用系统 Python** 运行，依赖通过 `pip install --user` 安装到用户目录，**不使用 venv，也不使用 conda**。本项目为 **`video2text-web`**（Web 端 License/订阅后端），请勿与桌面端项目 **`video2text`** 混淆；二者环境相互独立。
- **开发方式**：Windows + VSCode Remote - SSH 连接 Ubuntu（或直接在 WSL Ubuntu 中开发）；终端即 Ubuntu 终端，直接使用系统 Python，**无需 Docker Desktop**。前端（Astro）继续在 Windows 本地开发。
- 后端 `.env`（密钥）仅在 Ubuntu 本地创建，权限受限，**绝不**进仓库（见 14.2）。

```bash
# 在 VSCode Remote 终端（Ubuntu / WSL）中执行，直接使用系统 Python
cd backend
python3 -m pip install --user -r requirements.txt
```

- VSCode Remote 使用系统 Python 解释器（如 `/usr/bin/python3`），见 [14.1.6](#1416-vscode-工程化配置)。

---

## 14.2 本地测试（后端，P3）

> 前置：已按 [14.1.7](#1417-本地-python-环境系统-python-backend-p3) 用系统 Python 装好依赖（`pip install --user`，Ubuntu via VSCode Remote）。

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
- 部署校验：`alembic upgrade head` 在 CI 内对测试库校验迁移（见 `backend.yml` 的 `migrate-check` job）；生产不再构建 Docker 镜像。

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

### 14.5.1 GSC "网页包含重定向 (Page with redirect)" 排障

> 现象：Google Search Console 报告 100+ 页 "Page with redirect"，覆盖大多数语言/路由。原因不是站点故障，而是 **Astro `build.format: "directory"` + Cloudflare Pages 强制 Pretty URLs** 下，任何一个不带末尾 `/` 或残留 `.html` 的内部 URL 都会在边缘触发 308 → 目录索引文件 → 200 的多重重定向链。

**本项目的实现契约**（由 `astro.config.mjs` / `scripts/fix-sitemap.mjs` / `scripts/fix-internal-links.mjs` 共同保证）：

1. **构建产物**：每个路由编译为**目录形式**（`dist/<lang>/index.html`、`dist/<lang>/<path>/index.html`、`dist/<lang>/<path>/<sub>/index.html`），URL 即目录路径，必须以 `/` 结尾才能直接命中 Cloudflare Pages 的目录索引文件。
2. **Cloudflare Pages 设置**（必须）：**Pretty URLs 必须保持开启**（项目无法关闭），即 Cloudflare 把 `dist/<dir>/index.html` 自动以 200 返回给 `/<dir>/`。
3. **构建管线**（已接入 `npm run build`）按顺序产出正确 URL：

   ```text
   astro build (build.format: "directory", trailingSlash: "always")
     → src/pages/[lang]/X.astro 编译为 dist/[lang]/X/index.html（单段）
       或 dist/[lang]/X/<sub>/index.html（多段、来自 getStaticPaths）
     → scripts/fix-sitemap.mjs 给 sitemap-0.xml 补回末尾 /
     → scripts/fix-internal-links.mjs 把所有 dist/**/*.html 内
       href / canonical / hreflang / og:url / JSON-LD url / @id
       中"path-only 或绝对站内"的链接改写为以 / 结尾的目录形式，
       并校验 dist/ 中存在对应目录，使任何内部 URL 直连静态文件
   ```

   修改任一组件后若新出现的链接又退回 `/en` 或 `/en/blog.html` 形式（极少见），`fix-internal-links.mjs` 会自动修复并在控制台打印 `fix-internal-links: N file(s), M attribute(s) rewritten`。

**验证**（部署后必做，覆盖 GSC 报错 URL）：

```bash
# 1) 任选三个有代表性的页面，curl -I 看返回码与 Location
curl -sI https://video2text.dpdns.org/en/ | head -1                 # 期望 200，无 Location
curl -sI https://video2text.dpdns.org/en/blog/ | head -1            # 期望 200，无 Location
curl -sI https://video2text.dpdns.org/en/docs/getting-started/ | head -1  # 期望 200，无 Location

# 2) 抓站内链接确认已全部以 / 结尾（无 .html、无裸路径）
curl -s https://video2text.dpdns.org/en/ \
  | grep -oE 'href="https://video2text.dpdns.org/[^"]+"' \
  | sort -u | head
# 期望所有 hreflang/og:url/canonical 都以 / 结尾

# 3) GSC：重新提交 sitemap-index.xml，等待 3–7 天，索引覆盖率从 "Page with redirect" 恢复
```

**常见误改**（请勿做，会再次触发重定向）：

| 误改 | 结果 |
| ---- | ---- |
| `astro.config.mjs` 改回 `build.format: "file"` 或 `trailingSlash: "never"` | 产物变成 `/en.html` 等 .html 文件，但 Cloudflare 强制 Pretty URLs 会把它们 308 到 `/en/` 等目录形式，**链路反而更长** |
| `dist/_redirects` 添加 `/ /en 301` 之类的规则 | 触发额外 301，链路变长，`/` 也变成重定向起点 |
| 把 sitemap 中末尾的 / 去掉、回归无末尾 / 形式 | Cloudflare 会把无 / 路径 308 到同名目录，**链路变长**；保持 sitemap 与站点链接一致 |
| 让组件 / 插件（如 `astro:i18n` 的 `getRelativeLocaleUrl`）输出 `.html` 或裸路径 | 任意一条遗留都会污染 dist/；`fix-internal-links.mjs` 会兜底修复并在控制台报告数量 |

### 14.5.2 站点地图（sitemap）链路

> **问题**：之前使用 `@astrojs/sitemap` 集成，产物直接写入 `dist/sitemap-index.xml` 与 `dist/sitemap-0.xml`，但 Astro 路由表（dev / preview / 生产 Pages 均同源）对此类构建期直接落盘文件**不可见**，所以本地访问 `http://127.0.0.1:4321/sitemap-index.xml` 会 404，调试困难；且集成无法保证 URL 形式与本站 directory + trailingSlash 策略完全一致。双层 sitemapindex 还会触发部分 XML 解析器报错（`Attribute xmlns redefined`）。

**当前实现契约**（由 `src/lib/sitemap.ts` + `src/pages/sitemap.xml.ts` + `public/robots.txt` 共同保证）：

1. **URL 集合来源单一**：`src/lib/sitemap.ts` 的 `collectSitemapUrls()` 枚举全部静态路由（`/`, `/[lang]/`, `/[lang]/blog/`, … 共 12 段）+ blog/docs 全部 content 条目，**与 `src/lib/i18n-paths.ts`、`src/pages/[lang]/{blog,docs}/[...slug].astro` 的 `getStaticPaths` 完全同构**，新增/删除路由时三处一致。
2. **单文件 API route 渲染**：`src/pages/sitemap.xml.ts` 直接输出一个 `<urlset>`（不是 sitemapindex 套 urlset），避免双层结构与命名空间冲突。`xhtml:link` 用于 `hreflang` 交替（`x-default` 指向英文版）。
3. **统一 URL 形式**：所有 `<loc>` 与 `hreflang` 均以 `/` 结尾（与 `getRelativeLocaleUrl` / `localizedPath` 同源），无任何 `.html` 残留。
4. **`astro.config.mjs` 不再依赖 `@astrojs/sitemap`**：dev / preview / 生产三处行为完全一致，`http://127.0.0.1:4321/sitemap.xml` 返回 200。
5. **`robots.txt`** 末尾的 `Sitemap:` 指令指向 `https://video2text.dpdns.org/sitemap.xml`（GSC 期望的 sitemap 文件）。

**验证**（dev / preview / 部署后各跑一次）：

```bash
# 1) sitemap 200 且为合法 XML
curl -sI http://127.0.0.1:4321/sitemap.xml | head -1     # 期望 200
curl -s  http://127.0.0.1:4321/sitemap.xml | head -2     # 期望 <?xml ...?><urlset ...
# 也可用 python -c "import xml.etree.ElementTree as ET; ET.parse('dist/sitemap.xml')" 严格校验

# 2) 所有 <loc> 都以 / 结尾且对应 dist 文件存在
curl -s http://127.0.0.1:4321/sitemap.xml | grep -oE '<loc>[^<]+</loc>' | head
# 期望：每条 <loc> 形如 https://video2text.dpdns.org/<lang>/<path>/

# 3) GSC：Search Console → Sitemaps → 重新提交 sitemap.xml
```

**常见误改**：

| 误改 | 结果 |
| ---- | ---- |
| 在 `astro.config.mjs` 重新启用 `@astrojs/sitemap` | 双 sitemap（API route + 集成），dist 会同时出现 `sitemap.xml` 与 `sitemap-index.xml`，且 dev/preview 仍 404（集成产物不可见） |
| 把单文件拆回 `sitemap-index.xml` + `sitemap-0.xml` 双层结构 | 部分 XML 解析器因命名空间前缀处理不当报 "Attribute xmlns redefined"；且 GSC 对单层 urlset 收录更稳定 |
| 修改路由（新增/删除）但未同步 `src/lib/sitemap.ts` | sitemap 与实际页面不同步，GSC 报错；务必让 `collectSitemapUrls` 与 `getStaticPaths` 保持同构 |
| 在 `robots.txt` 把 `Sitemap` 改为 `sitemap-index.xml` | 该路径已不存在，GSC 找不到索引 |

---

## 14.6 后端开发与部署

### 14.6.1 本地开发（Windows + VSCode Remote → Ubuntu）

> 开发在 Ubuntu 上进行，Windows 仅作为 VSCode Remote 客户端。后端直接以 `uvicorn` 运行，**不使用 Docker**。

- 环境：Ubuntu（通过 VSCode Remote - SSH / WSL），直接使用系统 Python（依赖在用户目录）
- 数据：MySQL（本地开发需本机或可达的 MySQL 实例；`DB_URL` 指向 `127.0.0.1:3306/video2text`）
- 启动：

```bash
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
mysqldump -h 127.0.0.1 -u video2text -p video2text > backup/app-$(date +%F).sql
```

### 14.6.2 生产部署（Ubuntu / Oracle Cloud E2.1.Micro）

> 生产**不使用 Docker**：后端以系统 Python + systemd 单元 `video2text-api.service` 原生运行（依赖装到用户目录，不用 venv / conda），与开发环境解耦（开发环境直接 `uvicorn`，也不加 Docker）。省去 Docker daemon ~150MB 开销，在 1GB 小机上更宽裕，且运维更简单（日志走 `journalctl`，重启/回滚 = `git checkout` + `systemctl restart`）。

- 机器：Oracle Cloud `VM.Standard.E2.1.Micro`（1 OCPU / 1 GB，Always Free）。
- 内存：后端单进程（uvicorn 单 worker）+ Caddy 在 1GB 下宽裕；**MySQL 为独立服务**，不与该 VM 同机，无需为数据库分压。建议仍加 2GB swap 作为兜底（见阶段 2）。
- 形态：Python FastAPI **原生部署（系统 Python + systemd）+ 外部 MySQL**，部署于该 VM；保持精简（uvicorn 单 worker，不引重型依赖）。
- 反向代理/TLS：**VM 上用 Caddy 终止 443 并反代到 `127.0.0.1:8000`**。Caddy 自动申请/续期 Let's Encrypt 证书。
- 密钥管理：后端 `backend/.env` 仅存于 VM，权限 `600`；**绝不进仓库**（见下方「关键坑位」）。

#### 阶段 0 — 建机（一次性）

- Oracle Cloud 控制台建 `VM.Standard.E2.1.Micro`（Always Free，AMD 机型），1 GB 内存。
- 系统镜像：Ubuntu 24.04 LTS。
- 防火墙（Oracle 安全列表 / iptables）：放通入站 `22`（SSH）、`80`、`443`（Let's Encrypt http-01 验证与 TLS 都需）。

#### 阶段 1 — 基础环境

```bash
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y ca-certificates curl git python3-pip
```

> 无需安装 Docker。部署脚本 `backend/setup.sh` 会用系统 Python 安装依赖（`pip install --user`）并安装 systemd 单元。

#### 阶段 2 — 内存兜底（1GB，建议做）

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
python3 -c "import secrets;print(secrets.token_hex(32))"
python3 -c "import base64,os;print(base64.b64encode(os.urandom(32)).decode())"
```

> ⚠️ 上面**只输出值（不含键名）**。填入 `.env` 时只把输出贴到 `KEY=` 之后，**不要连键名一起写**——否则会变成 `JWT_SECRET=JWT_SECRET=...` / `LICENSE_ED25519_PRIVATE_KEY=LICENSE_ED25519_PRIVATE_KEY=...`：前者污染 JWT 密钥，后者因含 `=` 前缀导致 `base64` 解码失败、License 签发在运行时 500。若已误写，用 `sed -i` 去掉重复前缀或重建 `.env`。

`backend/.env` 要点：

- `DB_URL=mysql+pymysql://video2text:Video2text%23@<mysql-host>:3306/video2text`（**独立 MySQL**，填写实际主机地址；密码中的 `#` 必须 URL 编码为 `%23`）。
- `APP_ENV=production`。

#### 阶段 3.5 — 创建 MySQL 数据库（必做，否则 `setup.sh` 失败）

`setup.sh` 的 `ExecStartPre` 会在每次启动时执行 `alembic upgrade head` 来建表；**该命令要求 `DB_URL` 指向的 `video2text` 库已经存在**，否则 alembic 连库失败、服务起不来，报：

```
sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1049, "Unknown database 'video2text'")
```

这是首次部署最容易漏的一步——MySQL 用户能连上、密码也对，只是**库还没建**。务必**先建库，再跑 `setup.sh`**：

```bash
# 在独立的 MySQL 主机上建库（字符集 utf8mb4）
mysql -h <mysql-host> -P 3306 -u video2text -p \
  -e "CREATE DATABASE IF NOT EXISTS video2text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# 若 video2text 用户无 CREATE DATABASE 权限，改用管理员账号执行上面的建库 + GRANT
```

> 建库后 `sudo bash setup.sh` 即幂等通过：`alembic upgrade head` 建表 → uvicorn 启动 → `/health` 返回 ok。

#### 阶段 4 — 安装 systemd 单元并启动

```bash
cd /home/ubuntu/video2text-web/backend
sudo bash setup.sh        # 装系统依赖 + pip --user 安装依赖 + 安装并启用 video2text-api.service
# 等价于手动：
#   python3 -m pip install --user -r requirements.txt
#   sudo cp video2text-api.service /etc/systemd/system/
#   sudo systemctl daemon-reload && sudo systemctl enable --now video2text-api
```

> `video2text-api.service` 以 `ubuntu` 用户运行（部署目录即其家目录），`WorkingDirectory=/home/ubuntu/video2text-web/backend`，pydantic 经该目录下的 `.env` 读密钥；`ExecStartPre` 每次启动前自动 `alembic upgrade head`。
>
> `setup.sh` 已内置规避两个本机会踩的坑：① 若机器把 `python3` 指向 deadsnakes 等非系统解释器，导致 `apt-get update` 因 `/usr/lib/cnf-update-db` 缺失 `apt_pkg` 而崩溃，脚本会自动把该钩子 shebang 改回系统 python3；② systemd 单元使用绝对路径 `/home/ubuntu/.local/bin/{uvicorn,alembic}`（而非 `%h`，后者在本机会被错误解析成 `/root`）。

#### 阶段 5 — Caddy 反代 + TLS（替代 Cloudflare Tunnel）

```bash
# Caddy（Ubuntu 仓库版即可）
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
- 无论哪种，都需放通 `80`/`443` 入站，且 `api.video2text.dpdns.org` 的 DNS 记录**已存在且生效**（Caddy 首次签发报 `NXDOMAIN` 即因记录未建，先 `dig +short api.video2text.dpdns.org` 确认解析到本机/Cloudflare）。

#### 阶段 6 — 启动后端 + 验证

```bash
sudo systemctl restart video2text-api
sleep 4
sudo systemctl status video2text-api   # active (running)
sudo journalctl -u video2text-api --tail 20   # 应无 missing 报错
curl -s http://127.0.0.1:8000/health            # 期望 {"status":"ok"}
curl -sI https://api.video2text.dpdns.org/health   # 经 Caddy/Cloudflare 443
sudo systemctl restart caddy       # DNS 刚生效后，重启让 Caddy 重新申请证书
```

#### 阶段 7 — 每日备份（防 VM 故障丢订单）

```bash
# 从独立 MySQL 实例用 mysqldump 导出（需在备份机/源站装 mysql 客户端）
# /etc/cron.d/backup-db
0 4 * * * root mysqldump -h <mysql-host> -u video2text -p'Video2text#' video2text > /home/ubuntu/video2text-web/backup/app-$(date +\%F).sql && \
  rclone copy /home/ubuntu/video2text-web/backup/app-$(date +\%F).sql r2:video2text-backup/db/   # 或 gsutil cp ... gs://video2text-backup/db/
```

#### 阶段 8 — 更新流程

```bash
cd /home/ubuntu/video2text-web && git pull   # .env 不会被覆盖（已在 .gitignore）
cd backend && sudo bash setup.sh     # 重装依赖并重启服务（setup.sh 幂等）
# 或仅重启：sudo systemctl restart video2text-api
```

#### 关键坑位速查

| 现象                                      | 原因                                                 | 修复                                                      |
| ----------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| 启动报 `JWT_SECRET ... missing`           | `.env` 缺失或未填必填项                              | 重建 `backend/.env` 并填真实密钥；确认 `git check-ignore` |
| 服务起不来 / 端口被占                      | 80/8000 被其他进程占用                               | `ss -ltnp` 查占用，停掉冲突进程（如 nginx）               |
| Caddy 起不来 `:80 address already in use` | 80 被 nginx 占用                                     | 停掉/禁用 nginx，让 Caddy 独占 80/443                     |
| Caddy 证书 `NXDOMAIN`                     | `api` DNS 记录未建                                   | Cloudflare 建 A 记录指向 VM IP，生效后 `restart caddy`    |
| Caddy `tls-alpn-01` 403                   | Cloudflare 橙云拦截挑战                              | 预期；改 Caddy 只跑 `:80`+CF Flexible，或改灰云           |
| 重新 `git pull` 后后端密钥变模板          | `.env` 被覆盖成 `.env.example`                       | 重建 `backend/.env` 并填真实密钥；确认 `.gitignore`       |
| 启动报 `error parsing value for field "frontend_origins"` | `FRONTEND_ORIGINS` 用逗号分隔，pydantic-settings 2.x 仅认 JSON 数组 | 改为 `FRONTEND_ORIGINS=["https://a","https://b"]`（见 `.env.example`） |
| 启动循环失败 / `ExecStartPre` 报 `(1049, "Unknown database 'video2text'")` | MySQL 可达但 `video2text` 库未建；`alembic upgrade head` 连不上库 | 先建库（见 阶段 3.5）：`CREATE DATABASE video2text CHARACTER SET utf8mb4`；再 `sudo bash setup.sh` |
| 服务起得来，但 License 签发 500 / `base64` 解码报错 | `.env` 把整行 `KEY=VALUE` 又当值写了，出现 `JWT_SECRET=JWT_SECRET=...`、`LICENSE_ED25519_PRIVATE_KEY=LICENSE_ED25519_PRIVATE_KEY=...` | 值里只保留 `=` 之后部分；用 `sed -i` 去掉重复键名前缀或重建 `.env`（见 阶段 3 生成密钥说明） |
| `apt-get update` 报 `cnf-update-db` / `No module named 'apt_pkg'` 后 `setup.sh` 中止 | 机器把 `python3` 指向 deadsnakes 等非系统解释器，apt 的 Post-Invoke 钩子崩溃 | `setup.sh` 已自动修复该钩子（改 `/usr/lib/cnf-update-db` shebang 回系统 python3）；无需手动处理 |

### 14.6.3 数据库与迁移（生产）

```bash
cd /home/ubuntu/video2text-web/backend
sudo -u ubuntu /home/ubuntu/.local/bin/alembic upgrade head     # 首次建表（service 的 ExecStartPre 已自动跑，手动补跑亦可）
# 备份（每日 cron，见 14.6.2 阶段 7；从独立 MySQL 用 mysqldump）：
#   mysqldump -h <mysql-host> -u video2text -p'Video2text#' video2text > /home/ubuntu/video2text-web/backup/app-$(date +%F).sql
# 上传对象存储（二选一，凭证经环境变量注入）：
#   rclone copy /backup/app-$(date +%F).sql r2:video2text-backup/db/
#   gsutil cp /backup/app-$(date +%F).sql gs://video2text-backup/db/
# 恢复演练（至少一次）：
#   mysql -h <mysql-host> -u video2text -p'Video2text#' video2text < /backup/app-<date>.sql
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

- [ ] `/`、`/en/`、`/zh/` 均可直接访问（200，无重定向，详见 14.5.1）
- [ ] 每页 `view-source` 确认 canonical / hreflang（en↔zh + x-default）正确，且全部以 `/` 结尾
- [ ] `sitemap.xml`、`robots.txt` 在 dev/preview/生产均 200；sitemap 全部 URL 以 `/` 结尾并命中 dist/ 文件（详见 14.5.2）
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

git commit -m "Release v2.0"

步骤 3：创建 tag

git tag -a v2.0 -m "Release v2.0"

步骤 4：推送 commit 和 tag 到远程

git push origin main
git push origin v2.0

```

- /changelog 版本刷新：由 Cloudflare Deploy Hook / 定时重建触发（见 14.5），**不**依赖桌面端仓库事件。
- 发布博客：每次发版写一篇 changelog 博客，制造更新信号（[12 §12.3](./12-content-seo.md)）。

---

## 14.9 上线后监控与回滚

### 监控

- 前端：Cloudflare Analytics / Web Analytics（无 Cookie）；Search Console + Bing Webmaster 验证收录。
- 后端：`/health` Uptime 探针（如 UptimeRobot）；错误日志告警（邮件/webhook）；MySQL `mysqldump` 备份成功告警。
- 指标（P3+）：pricing→checkout 转化、付费数、退款率（[12 §12.6](./12-content-seo.md)）。

### 回滚

- 前端：Cloudflare Pages → 部署历史 → 「Revert to」一键回滚；或 `git revert` + 重新部署。
- 后端：`git checkout <prev>` 后 `sudo systemctl restart video2text-api` 回滚旧版；数据库迁移若不可逆需先评估（Alembic `downgrade` 演练）。
- Webhook 异常：暂停 Paddle 事件处理开关（env flag），人工补单，避免重复签发。

### 应急

- /changelog Release API 失败：页面兜底已构建版本日志 + 「查看所有版本」链接（[06 §6.1](./06-implementation.md)）。
- 私钥/密钥泄露：立即在 Paddle / 平台轮换，撤销相关 License 并邮件通知，旧 key 失效需桌面端发版。
- 单 VM 故障：凭每日备份在备用实例快速重建（[10 §10.6](./10-risks.md)）。

---

## 14.10 阶段上线清单（速查）

| 阶段 | 关键动作                                               | 退出标准                              |
| ---- | ------------------------------------------------------ | ------------------------------------- |
| P1   | Pages 部署 `/en`、`/zh` 静态站；死链+Lighthouse 通过   | 公网可访问，SEO 基础达标              |
| P2   | SEO 全量、Release 动态版本、双语内容、域名固定稳定运营 | Search Console 收录，下载指向真实资产 |
| P3   | Oracle Cloud 后端 + Paddle Webhook + License 签发/邮件          | sandbox 全链路跑通，幂等/退款验证     |
| P4   | 支付宝回调 + `/account` 自助换机                       | 全渠道收款可用                        |

---

> 本手册与 [09-deployment.md](./09-deployment.md)（架构）、[13-code-design-detail.md](./13-code-design-detail.md)（编码依据）配套。任何部署偏差回写本文件。
