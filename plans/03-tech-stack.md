# 03 · 技术选型

> 模块定位：明确前后端技术栈、选型理由，以及被否决的备选方案。
> 上级索引：[00-overview.md](./00-overview.md)

## 3.1 前端（核心）

| 类别 | 选型 | 理由 |
| --- | --- | --- |
| 框架 | **Astro**（v5+，`output: 'static'`） | 内容站点首选，默认零 JS、极致 SEO、Markdown/MDX 原生支持，契合"官网 + 文档 + 博客" |
| 交互框架 | **React**（`@astrojs/react`，仅少量组件） | 移动端菜单、下载检测等需要客户端状态/行为的局部交互；能用纯 Astro + 少量原生 JS 实现的**不引入 React** |
| 样式 | **Tailwind CSS v4**（通过 `@tailwindcss/vite` 插件接入） | 原子化、可维护。注意：`@astrojs/tailwind` 集成在 Tailwind v4 时代已不再是推荐方式，改用官方 Vite 插件 + `@import "tailwindcss"` |
| 内容 | `@astrojs/mdx` + Content Collections（Content Layer） | 博客/文档统一 schema 与类型安全 |
| 站点地图 | `@astrojs/sitemap` | 自动生成 `sitemap-index.xml`，支持 i18n 配置 |
| 图标 | **lucide**（`lucide-static` / 内联 SVG） | 轻量、无重型 UI 库依赖；避免整包引入 |
| i18n | **Astro 内置 `i18n` 配置** + 自建文案字典 | `defaultLocale: 'en'`、`locales: ['en','zh']`、`routing.prefixDefaultLocale: true`，配合 `getRelativeLocaleUrl` 等辅助函数 |
| 评论（博客，后期） | **Giscus**（GitHub Discussions） | 免自建后端，复用 GitHub 身份 |
| 分析（可选） | **Cloudflare Web Analytics** 或 **Plausible** | 无 Cookie、隐私友好，与"Local & Private"定位一致；须在隐私政策披露 |

### 3.1.1 版本与依赖约定

- Node 版本用 `.nvmrc` / `package.json` `engines` 固定，并在 Cloudflare Pages 设置 `NODE_VERSION`，避免构建环境漂移。
- 依赖锁定 `package-lock.json`，CI 用 `npm ci`。
- 依赖升级走 PR + 构建验证（可选 Dependabot / Renovate）。

### 3.1.2 为何不选 SPA（Next.js / Vite+React）

- SEO 与首屏性能：Astro 静态输出对爬虫与 Lighthouse 更友好，官网以内容展示为主，无需重客户端应用。
- 成本：纯静态可托管于 Cloudflare Pages / Netlify / Vercel 免费额度，前期零服务器成本。
- 文档/博客：Astro Content Collections 对 MD/MDX 的支持开箱即用，强于手写 SPA 路由。
- 备选未采纳：**Starlight**（Astro 官方文档主题）功能强但会绑定文档站视觉体系，与营销首页风格统一成本较高；若文档量后续暴增，可只把 `/docs` 迁到 Starlight。

### 3.1.3 前端质量保障

| 项 | 工具 |
| --- | --- |
| 类型/语法检查 | `astro check` + `tsc --noEmit` |
| 代码风格 | ESLint（`eslint-plugin-astro`）+ Prettier（`prettier-plugin-astro`） |
| 死链检查 | `lychee` 或 `linkinator`（对 build 产物执行） |
| 性能预算 | Lighthouse CI（目标：Performance ≥ 95，SEO = 100，A11y ≥ 95） |

> 静态站点无需单元测试框架；**构建成功 + 死链检查 + Lighthouse** 即为质量门槛。

## 3.2 后端（预留，后期 P3 启用）

| 类别 | 选型 | 理由 |
| --- | --- | --- |
| 语言/框架 | **Python + FastAPI** | 与桌面端技术栈一致，便于复用逻辑与经验 |
| 数据库 | **SQLAlchemy 2.x**（SQLite 起步 / Postgres 生产） | 起步零运维，生产可平滑迁移；禁止写死原生 SQL 方言 |
| 迁移 | **Alembic** | 从第一天起管理 schema 变更，避免手工改表 |
| 鉴权 | **JWT**（PyJWT）+ Argon2/bcrypt 口令哈希 | 用户系统轻量可行 |
| License 签名 | **Ed25519**（`cryptography` / PyNaCl） | 离线可验证的签名许可，私钥仅存后端（见 [08](./08-license-design.md)） |
| 邮件 | 事务邮件服务（Resend / SES / Postmark） | 自建 SMTP 送达率差；需自有域名配置 SPF/DKIM/DMARC |
| 部署 | **Docker + uvicorn** | 与 GCP e2-micro 适配，镜像化可移植 |
| 配置 | `.env`（经部署平台 / Actions Secrets 注入） | 密钥不进仓库 |
| 测试 | **pytest**（Webhook 验签、License 状态机为必测项） | 支付与授权逻辑不允许无测试上线 |

职责（后期）：

- MoR 支付 Webhook 验签与幂等落库（Paddle；备选 Lemon Squeezy / Creem / Polar）
- License 签发、激活、设备管理与撤销
- 用户注册/登录（JWT）
- 邮件发送（License 交付、收据补发）
- 支付宝回调（国内，更后期）
- `/health` 健康检查（供监控与部署探针）

## 3.3 前后端解耦约定

- 静态前端 + API 后端：前期零成本托管，后期按需开启后端收款，互不影响。
- 通信：REST API（JSON）。
- 环境指向（推荐 **独立子域**，见 [09 §9.3](./09-deployment.md)）：
  - 生产：`https://api.video2text.dpdns.org`（Cloudflare 代理到后端），FastAPI 显式配置 CORS 白名单。
  - 开发：`http://localhost:8000`。
  - 前端通过构建期环境变量 `PUBLIC_API_BASE` 注入，不硬编码。
- **红线**：任何密钥、License 校验、支付验签只在后端完成，前端不得硬编码。

## 3.4 选型理由小结

- Astro 的 SEO 与性能远优于 SPA，契合官网 + 文档 + 博客场景。
- 静态前端 + API 后端：前期零成本，后期按需开启收款，互不影响。
- Python 后端与桌面端一致，降低维护成本。
- 后端范围严格收敛为"用户 + 订单 + License"，不承载任何转写计算。

## 3.5 关联模块

- 页面与组件设计见 [04-pages-layout.md](./04-pages-layout.md)
- 目录结构见 [05-code-architecture.md](./05-code-architecture.md)
- 部署见 [09-deployment.md](./09-deployment.md)
