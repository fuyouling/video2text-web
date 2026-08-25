# 07 · 实施路线（分阶段）

> 模块定位：把整体工作拆成可交付的阶段与里程碑，便于排期与验收。
> 上级索引：[00-overview.md](./00-overview.md)

| 阶段           | 目标         | 主要产出                                                                        | 退出标准                                                         |
| -------------- | ------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **P0**         | 骨架就绪     | 初始化 Astro + Tailwind v4 + React；layouts / components / i18n 字典（en 优先） | 可本地跑通的多语言空站点，`npm run dev`、`astro check` 通过      |
| **P1**         | 静态官网上线 | 首页、功能页、定价（静态）、文档/博客框架、隐私/条款/退款                       | 英语优先站点部署到 Cloudflare Pages，死链检查 + Lighthouse 达标  |
| **P2**         | 可对外推广   | 中文同步、SEO（hreflang/canonical/sitemap）、Release 动态版本、内容填充         | 双语完整、Search Console 收录、下载指向真实资产                  |
| **P3（后期）** | Pro 收款能力 | Python 后端：用户 / License / MoR 支付 Webhook（Paddle）                        | `/checkout` 跳转 Paddle，Webhook 验签落库并签发/邮件交付 License |
| **P4（后期）** | 全渠道收款   | 国内支付宝接入、用户中心与 License 自助管理                                     | 支付宝回调 + `/account` 自助换机/退款状态                        |

> 关键前置：**Paddle 账户申请**建议在 P2 期间启动，避免阻塞 P3（见 [11 §11.1](./11-tbd.md)）。

## 阶段细化

### P0 · 初始化骨架

- [ ] `npm create astro` + `@astrojs/react` + `@astrojs/mdx` + `@astrojs/sitemap`
- [ ] Tailwind v4：`@tailwindcss/vite` + `global.css`（`@import "tailwindcss"` + 设计令牌）
- [ ] Astro `i18n` 配置（`defaultLocale:'en'`、`locales:['en','zh']`、`prefixDefaultLocale:true`）
- [ ] `BaseLayout.astro` + `SEOHead.astro`：SEO/OG/canonical/hreflang 骨架
- [ ] 组件：`Header`/`Footer`/`Hero`/`FeatureCard`/`Workflow`/`CTASection`/`LangSwitch`/`PricingCard`
- [ ] `src/i18n/{ui,en,zh,utils}.ts` 字典骨架 + `[lang]` 路由 + `/`→`/en` 重定向
- [ ] 固定 Node 版本（`.nvmrc` / `engines`），配置 ESLint + Prettier

### P1 · 静态官网上线

- [ ] 首页全部区块（Hero / 6 特性卡 / 工作流 / 信任背书 / 下载 CTA）
- [ ] `/changelog`（静态兜底版本号 1.0 起步，P2 再接动态）
- [ ] `/features` 详细分点 + 占位截图
- [ ] `/pricing` 静态 Free + Pro（$9.9，权益不含代付云额度）
- [ ] `/docs`、`/blog` 框架 + `content/config.ts`（含 lang 字段）
- [ ] `/privacy`、`/terms`、`/refund`、`/contact`、`404`
- [ ] `/en` 默认 + `/zh` 同结构
- [ ] CI：build + `astro check` + 死链检查 + Cloudflare Pages 部署 + PR 预览

### P2 · 内容推广

- [ ] 中文全量同步（含法务页）
- [ ] SEO：sitemap、robots、OG 图、JSON-LD、canonical、hreflang、Search Console/Bing 验证
- [ ] /changelog 接入 GitHub Release 动态版本（构建期注入 + 定时重建）；`/changelog` 版本日志页（Release 列表注入）
- [ ] 填充卖点文案、截图/动图、教程博客
- [ ] 文档/博客原生维护于本站（不从外部仓库同步）
- [ ] **域名与 SEO 稳定运营**：确认 dpdns.org 在搜索引擎稳定收录，无域名切换计划
- [ ] Lighthouse CI 纳入门槛

### P3 · 后端收款（Paddle）

- [ ] 数据模型落地（User / Order / License / Device / Plan / WebhookEvent）+ Alembic 迁移
- [ ] FastAPI 骨架 + SQLAlchemy 2.x + JWT + `/health` + CORS 白名单
- [ ] `users` / `license` / `webhooks`（Paddle 验签 + 幂等）API + `services/` 逻辑
- [ ] License Ed25519 签名签发 + 邮件交付（事务邮件服务）
- [ ] `/checkout` 跳转 Paddle 收银台；退款 → License `refunded/revoked`
- [ ] pytest：Webhook 验签、License 状态机、幂等
- [ ] 部署到 Oracle Cloud E2.1.Micro（或 Cloud Run），`api.video2text.dpdns.org` + Cloudflare 代理
- [ ] 桌面端联动：License 激活/校验对接（跨仓库协调）

### P4 · 全渠道与自助

- [ ] 支付宝回调 `alipay.py`（需国内合规主体）
- [ ] `/account` 用户中心：登录、License 列表、设备注销（自助换机）
- [ ] 退款状态同步（Paddle revoked → License 失效 → 桌面端下次校验失效）

## 依赖与并行

- P0 → P1 → P2 为线性主线（静态站点）。
- P3 后端可在 P2 进行中并行预备（数据模型设计在 P1 末期完成，Paddle 账户在 P2 申请）。
- P4 依赖 P3 完成。
- **跨仓库依赖**：P3/P4 的 License 激活需要 `video2text` 桌面端配合改造，需两仓库协同排期（见 [10 §10.8](./10-risks.md)）。
