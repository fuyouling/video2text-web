# 05 · 代码架构

> 模块定位：定义前后端目录结构与各目录/模块的职责边界。
> 上级索引：[00-overview.md](./00-overview.md)

## 5.1 前端目录结构

```
video2text-web/
├── astro.config.mjs             # 含 i18n(defaultLocale:'en', locales:['en','zh']) + sitemap + redirects
├── package.json                 # engines 固定 Node 版本；scripts: dev/build/check/lint
├── tsconfig.json
├── .nvmrc                       # 锁定 Node 版本
├── .env.example                 # PUBLIC_API_BASE 等公共变量示例（无密钥）
├── public/                      # 静态资源（favicon、og 图、截图、动图、robots.txt）
│   ├── images/
│   └── og/
├── src/
│   ├── components/              # 可复用 .astro / .tsx 组件
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── Hero.astro
│   │   ├── FeatureCard.astro
│   │   ├── Workflow.astro
│   │   ├── CTASection.astro
│   │   ├── SEOHead.astro        # title/description/OG/canonical/hreflang/JSON-LD
│   │   ├── DownloadButton.astro
│   │   ├── LangSwitch.astro
│   │   └── PricingCard.astro
│   ├── layouts/
│   │   └── BaseLayout.astro     # 全局 SEO、字体、Header/Footer 包裹
│   ├── pages/
│   │   ├── (不创建 index.astro)  # / → /en 由 astro.config redirects + Cloudflare 301 实现（见 13 §13.5）
│   │   ├── 404.astro
│   │   └── [lang]/              # 语言子路径（en/zh）下的页面
│   │   │   ├── index.astro
│   │   │   ├── features.astro
│   │   │   ├── changelog.astro    # 版本更新日志（P2，Release 列表构建期注入）
│   │   │   ├── pricing.astro
│   │   │   ├── contact.astro
│   │   │   ├── privacy.astro
│   │   │   ├── terms.astro
│   │   │   ├── refund.astro
│   │   │   ├── blog/
│   │   │   │   ├── index.astro
│   │   │   │   └── [slug].astro
│   │   │   └── docs/
│   │   │       ├── index.astro
│   │   │       └── [...slug].astro
│   ├── content/                # content collections（博客/文档源）
│   │   ├── blog/                # 统一用 frontmatter lang 字段，不分目录（见 13 §13.7）
│   │   ├── docs/
│   │   └── config.ts           # 定义 collection schema（含 lang 字段）
│   ├── i18n/                   # UI 文案字典（en 优先，zh 同步）
│   │   ├── ui.ts               # 类型化 key 字典（en 为基准，zh 缺失回退 en）
│   │   ├── en.ts
│   │   ├── zh.ts
│   │   └── utils.ts            # getLangFromUrl / useTranslations / 语言 URL 映射
│   ├── lib/                    # 纯函数/数据获取（构建期 & 组件复用，见 13 §13.1）
│   │   ├── env.ts              # 类型化读取 PUBLIC_* 变量
│   │   ├── github.ts           # Release 拉取与下载资产解析
│   │   ├── seo.ts              # JSON-LD / hreflang
│   │   └── i18n-paths.ts       # 共享 getStaticPaths（不可放 src/pages 下）
│   ├── styles/
│   │   └── global.css          # Tailwind 入口 + 设计令牌
│   └── scripts/                # 少量客户端 TS（平台检测、菜单、定价切换）
├── scripts/                    # 项目脚本（非客户端：generate_icon.py 等；文档原生维护于 src/content，无同步脚本）
├── .github/workflows/          # CI（build + check + lint + 部署 + 定时重建）
└── (后期) backend/             # Python 后端独立目录（见 5.2）
```

> i18n 路由落地建议：用 `[lang]` 动态段统一承载语言，配合 Astro 内置 `i18n` 配置 + `src/i18n` 字典 + `getStaticPaths` 生成 `/en`、`/zh` 两套静态页；缺失翻译键回退英文。
>
> 说明：Tailwind v4 不再需要 `tailwind.config.mjs`（配置移入 CSS `@theme`），如仍需 JS 配置可保留；样式通过 `@tailwindcss/vite` 接入（见 [03 §3.1](./03-tech-stack.md)）。

## 5.2 后端目录结构（预留，后期启用）

```
video2text-web/backend/
├── app/
│   ├── main.py                # FastAPI 入口（含 /health、CORS 白名单）
│   ├── api/
│   │   ├── webhooks.py        # MoR 支付 Webhook（Paddle；验签 + 幂等）
│   │   ├── alipay.py          # 国内支付宝回调（后期）
│   │   ├── license.py         # License 激活/校验/设备管理
│   │   ├── users.py           # 注册登录（JWT）
│   │   └── health.py          # 健康检查
│   ├── services/              # 业务逻辑（与 API 层解耦，便于测试）
│   │   ├── license_service.py # License 签发/撤销/状态机 + Ed25519 签名
│   │   ├── payment_service.py # 订单落库、Webhook 事件处理
│   │   └── mail_service.py    # 事务邮件（License 交付/收据）
│   ├── core/
│   │   ├── config.py          # 配置（读取 .env，pydantic-settings）
│   │   ├── db.py              # SQLAlchemy 2.x 会话/引擎
│   │   ├── security.py        # JWT / 口令哈希 / 密钥加载
│   │   └── logging.py         # 结构化日志
│   ├── models/                # ORM 模型：User / Order / License / Plan / Device / WebhookEvent
│   └── schemas/               # Pydantic 请求/响应
├── migrations/                # Alembic 迁移脚本
├── tests/                     # pytest（Webhook 验签、License 状态机为必测）
├── requirements.txt           # 或 pyproject.toml（推荐锁定版本）
├── alembic.ini
├── Dockerfile
├── docker-compose.yml         # 生产部署用；本地开发直接 uvicorn（见 14 §14.6.1）
└── .env.example
```

> 后端范围严格收敛：**不承载任何转写/AI 计算**，仅"用户 + 订单 + License + 邮件"。所有支付/授权敏感逻辑集中在 `services/`，API 层薄。

## 5.3 前后端解耦约定

- 通信：REST API（JSON）。
- 前端指向（推荐独立子域，见 [09 §9.3](./09-deployment.md)）：
  - 生产：`https://api.video2text.dpdns.org`（Cloudflare 代理到后端），后端配置 CORS 白名单仅允许站点域名。
  - 开发：`http://localhost:8000`。
  - 通过构建期变量 `PUBLIC_API_BASE` 注入，不硬编码。
- **红线**：任何密钥、License 校验、支付验签只在后端；前端不得硬编码敏感逻辑。

## 5.4 数据模型（后端 ORM，P1 末期即设计）

```text
User        (id, email[unique], paddle_customer_id, created_at)
Order       (id, user_id, paddle_order_id[unique], plan_id, amount_cents, currency, status, created_at)
License     (id, user_id, order_id, key_hash, status[active|revoked|refunded],
             max_devices, created_at, revoked_at)
Device      (id, license_id, machine_id_hash, first_seen_at, last_active_at, revoked_at)
Plan        (id, name, price_cents, currency, billing_type[one-time], features_json)
WebhookEvent(id, provider, event_id[unique], type, payload_json, processed_at)  # 幂等去重
```

> 说明：
> - License 存 `key_hash`（如 SHA-256/HMAC）而非明文，明文仅在签发时一次性交付给用户；
> - `activated_devices` 用 `Device` 关联表计数，避免冗余可变字段导致不一致；
> - `WebhookEvent` 保证支付回调**幂等**（同一事件多次投递只处理一次）；
> - 金额用整数（最小货币单位，分）存储，避免浮点误差。

详细 License 设计见 [08-license-design.md](./08-license-design.md)。
