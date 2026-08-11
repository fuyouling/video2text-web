# 13 · 代码设计详细（逐文件类 / 方法 / Props）

> 模块定位：在 [05-code-architecture.md](./05-code-architecture.md) 目录结构基础上，逐文件给出**类、函数、组件 Props、类型与签名**，作为编码阶段的直接依据。
> 上级索引：[00-overview.md](./00-overview.md)
> 适用阶段：P0（骨架）→ P1（静态站点）→ P3（后端）
> 约定：类型优先；路径以 `05` 为准；前端用 TypeScript，后端用 Python 3.11+ / FastAPI。

---

## 13.0 通用约定

- **语言 / 类型**：前端 `TypeScript strict`；后端 `Python 3.11+`，类型注解齐全。
- **错误模型**：前端用轻量 `fallback` 兜底（下载页、i18n 缺键回退 en）；后端用 `HTTPException` + 统一错误 schema `{error: {code, message}}`。
- **配置注入**：
  - 前端公共变量走 `astro:env` 的 `PUBLIC_*`：`PUBLIC_API_BASE`、`PUBLIC_RELEASE_REPO`、`PUBLIC_GITHUB_API`、`PUBLIC_SITE`。
  - 后端密钥走 `pydantic-settings` 从 `.env` / 平台变量读取，**绝不**进仓库。
- **命名**：组件 PascalCase；工具函数 camelCase；后端模块 snake_case；ORM 模型 PascalCase 单数。

---

## 13.0.1 模块与文件总览（整体编码地图）

> 编码时按此表逐文件落地；方法名/签名见各小节，本表只给职责与依赖关系。

| 层 | 文件 | 职责 | 依赖 |
| --- | --- | --- | --- |
| 配置 | `astro.config.mjs` / `package.json` / `tsconfig.json` / `.nvmrc` / `src/env.d.ts` | 框架、i18n、构建脚本、公共变量类型 | — |
| i18n | `src/i18n/{ui,en,zh,utils}.ts` | 文案字典 + 语言解析/翻译/URL 映射 | — |
| 共享库 | `src/lib/{env,github,seo,i18n-paths}.ts` | 公共变量读取、Release 拉取解析、JSON-LD/hreflang、共享 getStaticPaths | i18n |
| 组件 | `src/components/*.astro` + `MobileMenu.tsx` | 可复用 UI 与 SEO 头 | i18n, lib |
| 布局 | `src/layouts/BaseLayout.astro` | 全局外壳 + SEO 注入 | components |
| 页面 | `src/pages/**` | 各路由 `getStaticPaths` + 渲染 | components, lib |
| 脚本 | `src/scripts/{download-client,menu}.ts` | 客户端平台检测、菜单 | — |
| 内容 | `src/content/config.ts` + `src/content/{docs,blog}` | 文档/博客 schema 与源 | — |
| 样式/资源 | `src/styles/global.css` + `public/` | 设计令牌、OG 图、截图 | — |
| 后端·核心 | `backend/app/core/{config,db,security,logging}.py` | 配置、会话、签名/哈希、日志 | — |
| 后端·模型 | `backend/app/models/*.py` | 6 张 ORM 表 | core.db |
| 后端·Schema | `backend/app/schemas/*.py` | 请求/响应模型 | — |
| 后端·服务 | `backend/app/services/{license,payment,mail}_service.py` | 业务：签发/支付/邮件 | models, schemas, core |
| 后端·API | `backend/app/api/{health,users,license,webhooks,_deps}.py` | 路由 + 鉴权/限流依赖 | services |
| 后端·入口 | `backend/app/main.py` | 装配 app/CORS/异常/路由 | api |
| 后端·迁移 | `backend/migrations/` + `alembic.ini` | schema 版本管理 | models |
| 后端·测试 | `backend/tests/` | 验签/状态机/幂等 | services, api |
| 后端·部署 | `backend/{Dockerfile,docker-compose.yml,requirements.txt,.env.example}` | 镜像/依赖/密钥样例 | — |
| 图片生成 | `scripts/generate_icon.py` | Pillow 程序化生成 favicon/OG/Logo/占位图 | — |

---

## 13.1 前端配置层

### `astro.config.mjs`

导出 `defineConfig({...})`，关键字段：

```js
export default defineConfig({
  site:               process.env.PUBLIC_SITE || 'https://video2text.dpdns.org',  // 生产域名由 PUBLIC_SITE 注入；默认 dpdns.org
  output:             'static',
  integrations:       [react(), mdx(), sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', zh: 'zh' } } })],
  i18n: {
    defaultLocale:    'en',
    locales:          ['en', 'zh'],
    // 非前缀路径（如 /features）不存在会 404：内链一律带 /[lang] 前缀；/ 由下方 redirects 处理
    routing:          { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  // 前提：src/pages 下不得创建 index.astro，否则该文件会覆盖此重定向（见 13.5）
  redirects:          { '/':        '/en', '/index.html': '/en' },
  vite:               { plugins: [tailwindcss()] },        // @tailwindcss/vite
});
```

- `site` 用 `PUBLIC_SITE` 注入（构建期/平台变量），不写死；固定生产域名为 `https://video2text.dpdns.org`。
- `/` → `/en`：**纯静态 + Cloudflare Pages 301**。除 Astro `redirects` 生成的 `/index.html` meta 跳转外，必须在 Cloudflare Pages 的 "Redirects/Rules" 中配置 `/` → `https://<site>/en` 的 301（服务端），保证 SEO 与爬虫正确。Pages Function 协商（方案②）本期不采用。
- 相关函数（无独立文件，由 Astro 调用）：`getStaticPaths()` 在各 `[lang]` 页面中生成 `en`/`zh`。

### `package.json`（scripts 段）

```jsonc
{
  "engines": { "node": ">=24" },
  "scripts": {
    "dev":      "astro dev",
    "build":    "astro build",
    "preview":  "astro preview",
    "check":    "astro check && tsc --noEmit",
    "lint":     "eslint . && prettier --check .",
    "fmt":      "prettier --write ."
  }
}
```

### `tsconfig.json` / `.nvmrc` / `.env.example`

- `tsconfig.json`：继承 `astro/tsconfigs/strict`，`paths` 映射 `@/* -> src/*`。
- `.nvmrc`：`24.14.0`（本机 Node 版本；与 `engines` 一致，供 Cloudflare `NODE_VERSION` 读取）。
- `.env.example`：仅含 `PUBLIC_*` 示例（`PUBLIC_SITE` / `PUBLIC_API_BASE` / `PUBLIC_RELEASE_REPO` / `PUBLIC_GITHUB_API`，默认 `https://api.github.com`），**无密钥**。

### `src/env.d.ts`

```ts
/// <reference path="../.astro/types.d.ts" />
interface ImportMetaEnv {
  readonly PUBLIC_SITE: string;
  readonly PUBLIC_API_BASE: string;
  readonly PUBLIC_RELEASE_REPO: string;   // owner/repo
  readonly PUBLIC_GITHUB_API: string;     // 默认 https://api.github.com
}
interface ImportMeta { readonly env: ImportMetaEnv; }
```

---

### 前端共享库（`src/lib`）

> 集中放「纯函数/数据获取」逻辑，供组件与页面复用，避免在 `.astro` frontmatter 里散落实现。

```ts
// src/lib/env.ts —— 类型化读取公共变量（astro:env 的 PUBLIC_*）
export const PUBLIC_SITE = import.meta.env.PUBLIC_SITE;
export const PUBLIC_API_BASE = import.meta.env.PUBLIC_API_BASE;
export const PUBLIC_RELEASE_REPO = import.meta.env.PUBLIC_RELEASE_REPO;
export function requirePublic(name: string): string;   // 缺失时构建期报错，避免静默退化

// src/lib/github.ts —— 下载页 Release 数据获取与解析（构建期调用）
export interface GitHubAsset { name: string; browser_download_url: string; size?: number; }
export interface GitHubRelease { tag_name: string; assets: GitHubAsset[]; html_url: string; }
export interface DownloadAsset {
  platform: 'windows'; arch: 'x64'|'arm64'; kind: 'installer'|'portable';
  url: string; size?: number; sha256?: string;
}
export async function fetchLatestRelease(repo: string): Promise<GitHubRelease | null>;
//   调 PUBLIC_GITHUB_API/repos/<repo>/releases/latest；失败返回 null（由页面兜底）
export function parseDownloadAssets(release: GitHubRelease): DownloadAsset[];
//   正则匹配 windows/x64|arm64/installer|portable，提取 url/size/sha256
export function fallbackVersion(): string;   // 本站常量 APP_VERSION（起始 1.0），与桌面端版本无关

// src/lib/seo.ts —— 结构化数据与 hreflang
export function buildSoftwareApplicationJsonLd(opts: {
  name: string; os: string; url: string; priceCents: number; currency: string;
}): Record<string, unknown>;     // SoftwareApplication + offers
export function buildArticleJsonLd(opts: { title: string; url: string; date: string; author: string }): Record<string, unknown>;
export function buildHreflang(path: string): { rel: string; href: string; hreflang: string }[];
//   供 SEOHead 渲染 <link rel="alternate">
```

### 静态资源与全局样式

- `src/styles/global.css`：Tailwind v4 入口 `@import "tailwindcss";`，在 `@theme` 中定义设计令牌（主色、灰阶、圆角、阴影、间距、字体栈）；`prefers-reduced-motion` 降级。
- `public/`：`favicon`、各页 `og/`（1200×630）、产品截图/动图（压缩为 webp/avif）、`robots.txt`。`robots.txt` 放行并声明 `sitemap-index.xml` 位置。

---

## 13.2 i18n 层（`src/i18n`）

### `ui.ts` — 文案类型与基准字典

```ts
export type Lang = 'en' | 'zh';
export type UIKey =
  | 'nav.features' | 'nav.download' | 'nav.docs' | 'nav.blog'
  | 'nav.pricing' | 'nav.contact' | 'cta.download' | 'cta.docs'
  | 'hero.title' | 'hero.subtitle' | 'hero.ctaPrimary' | 'hero.ctaSecondary'
  | 'features.title' | 'workflow.title' | 'pricing.free' | 'pricing.pro'
  | 'lang.en' | 'lang.zh' | 'footer.rights' | 'footer.privacy'
  | 'download.detected' | 'download.manual' | 'common.loading' | 'common.error';
// …（基准 en 键全集；新增键必须在此声明）
export const ui: Record<Lang, Record<UIKey, string>>;   // en 为完整集，zh 可部分
```

### `en.ts` / `zh.ts`

```ts
import type { UIKey } from './ui';
export const en: Record<UIKey, string> = {
  'nav.features': 'Features',
  'hero.title':   'Local, private transcription & summarization',
  // … 全量
};
export const zh: Partial<Record<UIKey, string>> = {
  'nav.features': '功能',
  'hero.title':   '本地、私密的音视频转写与总结',
  // … 同步子集
};
```

### `utils.ts` — 语言解析与翻译函数

```ts
import { ui } from './ui';
import type { Lang, UIKey } from './ui';

export function getLangFromUrl(url: URL): Lang;
//  读取 /en|/zh 第一段；缺省回退 'en'

export function useTranslations(lang: Lang): (key: UIKey) => string;
//  返回 t(key)：查 ui[lang][key]，缺失回退 ui.en[key]，仍缺失返回 key 本身（CI 警告）

export function getRelativeLocaleUrl(lang: Lang, path: string, opts?): string;
//  包装 Astro i18n，保证 path 不以 '/' 开头时正确拼接

export function localizedPath(currentPath: string, target: Lang): string;
//  将 /en/features ↔ /zh/features 互转，供 LangSwitch 保持同页

export function alternateUrls(currentPath: string): { en: string; zh: string; xdefault: string };
//  供 SEOHead 生成 hreflang
```

---

## 13.3 组件层（`src/components`，`.astro`）

> 每个组件通过 `export interface Props` 声明入参；渲染逻辑写在 frontmatter。React 组件仅用于需客户端状态处（如菜单），此处以 `.astro` 为主。

### `SEOHead.astro`

```ts
interface Props {
  title: string;
  description: string;
  lang: Lang;
  path: string;            // 当前路径（含 /en），用于 canonical/hreflang
  image?: string;          // OG 图绝对或相对路径
  type?: 'website' | 'article';
  publishedTime?: string;  // 文章页用
  noindex?: boolean;
}
// 渲染：<title>、meta description、OG/Twitter、canonical、hreflang 交替、JSON-LD
// 依赖：alternateUrls()（来自 i18n/utils）
```

### `Header.astro`

```ts
interface Props { lang: Lang; path: string; }
// frontmatter：从 useTranslations(lang) 取导航文案；GitHub 星标链接常量
// 内嵌 <MobileMenu> React 组件（见下）或纯脚本抽屉；输出 LangSwitch
```

### `Footer.astro`

```ts
interface Props { lang: Lang; }
// 输出版权、导航、社交、Privacy/Terms/Refund 链接、备案占位（仅国内启用）
```

### `Hero.astro`

```ts
interface Props { lang: Lang; }
// 主视觉 + 双 CTA（Download / View Docs）；截图/动图（prefers-reduced-motion 降级）
```

### `FeatureCard.astro`

```ts
interface Props {
  icon: keyof typeof iconMap;   // lucide 图标名（内联 SVG）
  title: string;
  desc: string;
  href?: string;                // “了解更多”链接
}
```

### `Workflow.astro`

```ts
interface Props { lang: Lang; }
// 从 useTranslations 取步骤文案；横向步骤条（移动端纵向）
```

### `CTASection.astro`

```ts
interface Props { lang: Lang; title?: string; subtitle?: string; }
// 通用下载引导区块
```

### `DownloadButton.astro`

```ts
interface Props {
  version: string;                 // 构建期注入（来自 getStaticPaths 拉取 Release）
  assets: DownloadAsset[];         // 见 13.5 下载页
  repo: string;                    // PUBLIC_RELEASE_REPO
}
// 客户端脚本（scripts/download-client.ts）做平台检测 + 失败兜底
// 导出方法（在 <script> 中）：detectPlatform() -> 'windows'|'unknown'
```

### `LangSwitch.astro`

```ts
interface Props { lang: Lang; path: string; }
// 渲染 EN/ZH；点击调用 localizedPath(path, target) 跳转同页
```

### `PricingCard.astro`

```ts
interface Props {
  plan: 'free' | 'pro';
  lang: Lang;
  price?: string;       // Pro: '$9.9'
  features: string[];
  ctaHref: string;      // Pro: /checkout（P3 生效，前期指向 /pricing 锚点）
  highlighted?: boolean;
}
```

### `MobileMenu.tsx`（React，仅客户端）

```tsx
export interface MobileMenuProps { lang: Lang; items: NavItem[]; }
export default function MobileMenu({ lang, items }: MobileMenuProps): JSX.Element;
// 维护 open 状态；Esc 关闭；focus trap 基本可达性
```

---

## 13.4 布局层（`src/layouts`）

### `BaseLayout.astro`

```ts
import type { Props as SEOProps } from '../components/SEOHead.astro';
interface Props extends SEOProps { /* 透传 SEO 字段 */ }
// 包裹：<html lang> + <head>(SEOHead) + Header + <slot/> + Footer
// 注入全局样式 global.css、字体；统一 <main> 语义结构
```

---

## 13.5 页面层（`src/pages`）

> 所有页面位于 `src/pages/[lang]/...`，通过 `getStaticPaths()` 生成 `en`/`zh` 两套。

### 根路径 `/`（不创建 index.astro）

- **不创建 `src/pages/index.astro`**：该文件一旦存在，会覆盖 `astro.config.mjs` 中 `redirects: {'/': '/en'}` 的静态重定向，导致 `/` 不跳转。
- `/` → `/en` 由 **Astro `redirects`**（生成 `/index.html` meta-refresh）+ **Cloudflare Pages 301 规则**共同实现（见 [04 §4.1](./04-pages-layout.md)）。
- 若未来改用 Pages Function 做 Accept-Language 协商（方案②），届时再新增该文件。

### `src/pages/[lang]/index.astro`（首页）

```ts
import { getStaticPaths } from '../../lib/i18n-paths';   // 见下
// getStaticPaths(): 返回 [{ params: { lang: 'en' } }, { params: { lang: 'zh' } }]
// 组合 Hero + 6×FeatureCard + Workflow + 信任对比 + CTASection + 下载区块
```

### `src/pages/[lang]/features.astro`

```ts
// getStaticPaths()；分点渲染 useTranslations 特性文案 + 占位截图
```

### `src/pages/[lang]/download.astro`

```ts
// getStaticPaths() 内：构建期 fetch PUBLIC_GITHUB_API/repos/<repo>/releases/latest
//   解析 assets 为正则匹配：windows x64 exe / x64 portable / arm64 exe / arm64 portable
//   解析失败（API 不可达/限流/超时）：fetchLatestRelease 返回 null，
//   页面用兜底 version（本站常量 APP_VERSION，起始 1.0，与桌面端无关）+ 全部资产链接，
//   且 **getStaticPaths 不得抛错**，保证 npm run build 在 GitHub 不可用时仍能成功
interface DownloadAsset { platform: 'windows'; arch: 'x64'|'arm64'; kind: 'installer'|'portable'; url: string; size?: number; sha256?: string; }
// 传给 DownloadButton.astro；输出系统要求说明
```

### `src/pages/[lang]/changelog.astro`（P2）

```ts
// 版本更新日志：getStaticPaths() 内构建期 fetch PUBLIC_GITHUB_API/repos/<repo>/releases?per_page=20
//   解析 tag_name / published_at / body，渲染为纯静态列表
//   失败兜底：空列表 + "查看全部版本"（Releases 链接）；getStaticPaths 不得抛错
```

### `src/pages/[lang]/docs/index.astro` 与 `[...slug].astro`

```ts
// 读取 src/content/docs 集合（content layer）
// getStaticPaths()：entry = getCollection('docs', e => e.data.lang === lang)
//   map 为 { params: { lang, slug: e.slug }, props: { entry } }
```

### `src/pages/[lang]/blog/index.astro` 与 `[slug].astro`

```ts
// getStaticPaths()：getCollection('blog', ...)；分页可选（P2）
// [slug] 注入 publishedTime、author 到 SEOHead（type: 'article'）
```

### `src/pages/[lang]/pricing.astro`

```ts
// 渲染 2× PricingCard（free/pro）；Pro 文案强调 $9.9 买断 + Paddle 托管
// FAQ 折叠（details/summary，无 JS）
```

### `src/pages/[lang]/{contact,privacy,terms,refund}.astro`

```ts
// contact：邮箱 + GitHub Issues 链接（无后端）
// privacy/terms/refund：合规文案（Markdown 内容或内联）
```

### `src/pages/404.astro`

```ts
// 多语言 404：读取 Accept-Language 或仅英文；提供返回首页
```

### 共享 `src/lib/i18n-paths.ts`

> ⚠️ **不能放在 `src/pages/` 下**：`.ts` 文件在 pages 目录会被 Astro 当作路由端点生成无用路由。统一放 `src/lib/`。

```ts
export function getStaticPaths() { return [{params:{lang:'en'}},{params:{lang:'zh'}}]; }
// 供所有 [lang] 页面复用，保证语言集合单一来源
```

---

## 13.6 客户端脚本（`src/scripts`）

### `download-client.ts`

```ts
export interface PlatformInfo { os: 'windows' | 'macos' | 'linux' | 'unknown'; arch: 'x64' | 'arm64' | 'unknown'; }
export function detectPlatform(): PlatformInfo;
//   优先 navigator.userAgentData.getHighEntropyValues(['architecture'])；回退解析 UA
//   绝不使用已废弃 navigator.platform
export function pickAsset(assets: DownloadAsset[], info: PlatformInfo): DownloadAsset | null;
export function refreshLatestVersion(repo: string): Promise<string | null>;  // 客户端二次刷新，失败返回 null 由页面兜底
```

### `menu.ts`

```ts
export function initMobileMenu(root: HTMLElement): void;   // 绑定汉堡/抽屉开关
```

---

## 13.7 内容集合（`src/content/config.ts`）

```ts
import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    lang:  z.enum(['en','zh']),
    order: z.number().default(99),
    category: z.string().optional(),
  }),
});
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    lang:  z.enum(['en','zh']),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    author: z.string().default('video2text'),
    draft: z.boolean().default(false),
  }),
});
export const collections = { docs, blog };
```

---

## 13.8 文档维护约定（本站独立）

> 本站文档（博客/教程/使用指南）**原生维护**于 `src/content`（见 [06 §6.4](./06-implementation.md)），**不提供任何外部仓库同步脚本**（不存在 `scripts/sync-docs.mjs` / `npm run sync:docs`）。如需复用既有资料，采用**人工整理后落地**到 `src/content` 的方式，避免跨仓库耦合与内容漂移。

---

## 13.9 后端详细设计（`backend/`，P3 启用）

### `app/main.py`

```python
def create_app() -> FastAPI:
    """装配路由、CORS、异常处理、/health。"""
    # 1) 实例化 FastAPI（title/version 来自 settings）
    # 2) configure_cors(app, settings.frontend_origins)
    # 3) register_exception_handlers(app)
    # 4) include_router: health, users, license, webhooks
    # 5) 返回 app
def configure_cors(app: FastAPI, origins: list[str]) -> None:
    """仅放行 PUBLIC_API_BASE 站点域名白名单。"""
def register_exception_handlers(app: FastAPI) -> None:
    """统一 400/401/422/429/500 -> {error:{code,message}}。"""
```

### `app/core/config.py`

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    # 服务
    app_env: str = "production"
    frontend_origins: list[str] = ["https://video2text.dpdns.org", "https://www.video2text.dpdns.org"]  # 生产域名固定为 dpdns.org；开发追加 http://localhost:4321
    # 数据库
    db_url: str = "sqlite:///./app.db"
    # 鉴权
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60 * 24 * 7
    # License 签名（Ed25519）
    license_private_key: str          # 仅后端；公钥由私钥派生（见 security.load_public_key）
    # 支付（Paddle）
    paddle_api_key: str
    paddle_webhook_secret: str
    paddle_environment: str = "sandbox"  # 上线切 production
    paddle_vendor_id: str | None = None
    # 邮件
    mail_api_key: str
    mail_from: str = "licensing@video2text.dpdns.org"
    # 风控
    activation_rate_limit_per_ip: int = 20

settings = Settings()
```

### `app/core/db.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

class Base(DeclarativeBase): ...
engine = create_engine(settings.db_url, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

def get_db() -> Generator[Session, None, None]:
    """FastAPI 依赖：请求级会话。"""
def init_db() -> None:
    """建表（开发/SQLite 起步；生产用 Alembic）。"""
```

### `app/core/security.py`

```python
import hashlib, hmac, jwt
from argon2 import PasswordHasher          # argon2-cffi
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

def hash_license_key(key: str) -> str:
    """SHA-256 哈希，入库只存哈希。"""
def generate_license_key() -> str:
    """V2T-PRO-XXXX-XXXX-XXXX，排除 0/O/1/I，CSPRNG 生成。"""
def verify_password(plain: str, hashed: str) -> bool:
def hash_password(plain: str) -> str:            # argon2id
def create_access_token(sub: str, extra: dict | None = None) -> str:
def decode_access_token(token: str) -> dict:     # 失败抛 InvalidToken
def sign_license_payload(payload: dict) -> str:  # Ed25519 私钥签名，返回 base64(token|sig)
def verify_license_token(token: str) -> dict:    # 派生公钥验签，返回 payload；失败抛 InvalidLicense
def verify_paddle_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    """校验 Paddle Webhook 签名（按 Paddle 文档的 HMAC/非对称方案，依环境选择）。"""
def load_private_key() -> Ed25519PrivateKey:
def load_public_key() -> Ed25519PublicKey:       # 由私钥派生（后端不自存公钥；桌面端内置公钥单独管理）
```

### `app/core/logging.py`

```python
def configure_logging(level: str = "INFO") -> None:
    """结构化（JSON）日志；脱敏密钥字段。"""
def get_logger(name: str): ...
```

### `app/models/`（ORM，继承 `Base`）

```python
# user.py
class User(Base):
    __tablename__ = "users"
    id: Mapped[int]; email: Mapped[str]  # unique
    paddle_customer_id: Mapped[str | None]
    created_at: Mapped[datetime]
    licenses: Mapped[list["License"]] = relationship(back_populates="user")

# plan.py
class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[str]                 # 'pro'
    name: Mapped[str]; price_cents: Mapped[int]; currency: Mapped[str]
    billing_type: Mapped[str]       # 'one-time'
    features_json: Mapped[str]      # JSON 字符串
    max_devices: Mapped[int] = 2

# order.py
class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int]; user_id: Mapped[int]; paddle_order_id: Mapped[str]  # unique
    plan_id: Mapped[str]; amount_cents: Mapped[int]; currency: Mapped[str]
    status: Mapped[str]             # 'paid'|'refunded'
    created_at: Mapped[datetime]
    license: Mapped["License | None"] = relationship(back_populates="order")

# license.py
class License(Base):
    __tablename__ = "licenses"
    id: Mapped[int]; user_id: Mapped[int]; order_id: Mapped[int | None]
    key_hash: Mapped[str]           # 仅哈希
    status: Mapped[str]             # 'active'|'revoked'|'refunded'
    max_devices: Mapped[int]
    created_at: Mapped[datetime]; revoked_at: Mapped[datetime | None]
    user / order relationships
    def is_active(self) -> bool
    def active_device_count(self, db) -> int   # 委托 service 统计（或 query Device）

# device.py
class Device(Base):
    __tablename__ = "devices"
    id: Mapped[int]; license_id: Mapped[int]
    machine_id_hash: Mapped[str]    # 仅哈希
    first_seen_at: Mapped[datetime]; last_active_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]

# webhook_event.py
class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    id: Mapped[int]; provider: Mapped[str]      # 'paddle'
    event_id: Mapped[str]           # unique，幂等去重
    type: Mapped[str]; payload_json: Mapped[str]
    processed_at: Mapped[datetime | None]
```

### `app/schemas/`（Pydantic）

```python
# auth.py
class UserCreate(BaseModel): email: EmailStr; password: str
class UserLogin(BaseModel): email: EmailStr; password: str
class TokenOut(BaseModel): access_token: str; token_type: str = "bearer"

# license.py
class LicenseActivateRequest(BaseModel):
    key: str; machine_id_hash: str     # 桌面端本地哈希后上报
class LicenseActivateResponse(BaseModel):
    license_token: str                 # Ed25519 签名载荷
    plan: str; entitlements: list[str]; recheck_after: datetime
class LicenseVerifyRequest(BaseModel): license_id: str; machine_id_hash: str
class LicenseVerifyResponse(BaseModel): status: str; recheck_after: datetime | None

# webhook.py
class PaddleWebhookEnvelope(BaseModel):
    event_id: str; event_type: str; data: dict

# 响应模型（供 API 返回，避免泄露内部字段）
class UserOut(BaseModel): id: int; email: str; created_at: datetime
class PlanOut(BaseModel): id: str; name: str; price_cents: int; currency: str; billing_type: str; max_devices: int
class OrderOut(BaseModel): id: int; paddle_order_id: str; plan_id: str; amount_cents: int; currency: str; status: str; created_at: datetime
class DeviceOut(BaseModel): id: int; machine_id_hash: str; first_seen_at: datetime; last_active_at: datetime; revoked_at: datetime | None
class LicenseOut(BaseModel): id: int; status: str; max_devices: int; created_at: datetime; devices: list[DeviceOut]
```

### `app/services/license_service.py`

```python
class LicenseService:
    def __init__(self, db: Session): ...
    def issue_license(self, *, user: User, plan: Plan, order: Order | None) -> License:
        """生成 key -> 存 key_hash -> 建 License 行。"""
    def activate(self, *, key: str, machine_id_hash: str) -> LicenseActivateResponse:
        """校验 key_hash/status/设备数；绑定 Device；签发 Ed25519 许可；超设备抛 409。"""
    def verify(self, *, license_id: str, machine_id_hash: str) -> LicenseVerifyResponse:
        """供周期复核；返回 active/revoked/refunded。"""
    def deactivate_device(self, *, license: License, machine_id_hash: str) -> None:
        """自助换机：置 Device.revoked_at。"""
    def revoke(self, *, license: License, reason: str) -> None:
        """退款/风控 -> status='revoked'|'refunded'，写审计。"""
    def count_active_devices(self, license: License) -> int:
        """SELECT count WHERE revoked_at IS NULL。"""
    def build_payload(self, license: License, machine_id_hash: str) -> dict:
        """构造 8.1 许可载荷（plan/entitlements/recheck_after）。"""
```

### `app/services/payment_service.py`

```python
class PaymentService:
    def __init__(self, db: Session, license_svc: LicenseService, mail_svc: MailService): ...
    def is_event_processed(self, event_id: str) -> bool:
        """WebhookEvent 幂等查重。"""
    def record_event(self, *, provider: str, event_id: str, type: str, payload: dict) -> WebhookEvent:
    def upsert_user_by_email(self, email: str, paddle_customer_id: str | None) -> User:
    def upsert_order(self, *, paddle_order_id: str, user: User, plan_id: str,
                     amount_cents: int, currency: str) -> Order:
    def handle_transaction_completed(self, data: dict) -> None:
        """支付成功：建/取订单 -> 调 license_svc.issue_license -> mail_svc.send_license_email。"""
    def handle_refund(self, data: dict) -> None:
        """退款/撤销（transaction.refunded）：license_svc.revoke(reason) -> mail_svc.send_refund_notice。"""
    def dispatch(self, event_type: str, data: dict) -> None:
        """按 event_type 路由到上述处理；未知类型记录不抛错。"""
```

### `app/services/mail_service.py`

```python
class MailService:
    def __init__(self, api_key: str, sender: str): ...
    def send_license_email(self, *, email: str, key: str, payload: dict) -> None:
        """一次性交付明文 key + 许可说明（事务邮件服务）。"""
    def send_refund_notice(self, *, email: str, order_id: str) -> None:
    def send_receipt(self, *, email: str, order: Order) -> None:
    def _send(self, to: str, subject: str, html: str) -> None:   # 调 Resend/SES/Postmark
```

### `app/api/health.py`

```python
def router() -> APIRouter:
    @router.get("/health")
    def health() -> dict: return {"status": "ok", "ts": ...}   # 供探针/监控
```

### `app/api/users.py`

```python
def router() -> APIRouter:
    @router.post("/auth/register");  # UserCreate -> UserOut（口令 argon2）
    @router.post("/auth/login");     # UserLogin -> TokenOut（JWT）
    @router.get("/me");               # 依赖 get_current_user -> UserOut
```

### `app/api/license.py`

```python
def router() -> APIRouter:
    @router.post("/license/activate");  # LicenseActivateRequest -> LicenseActivateResponse
    @router.post("/license/verify");    # LicenseVerifyRequest -> LicenseVerifyResponse
    # 限流：依赖 IP 级 RateLimit（security 提供）
```

### `app/api/webhooks.py`

```python
def router() -> APIRouter:
    @router.post("/webhooks/paddle")
    async def paddle_webhook(request: Request) -> dict:
        """1) 读原始 body + Paddle-Signature 头
           2) security.verify_paddle_signature(body, sig) -> bool
           3) 解析 envelope -> payment_svc.is_event_processed 幂等
           4) payment_svc.dispatch(event_type, data)
           5) 返回 200；验签失败 401；已处理 200（幂等）"""
```

### 辅助：`app/api/_deps.py`

```python
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")   # 仅声明，实际走 Bearer

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """解码 JWT -> 查库返回 User；失败 401。"""
def get_client_ip(request: Request) -> str:
    """取 X-Forwarded-For / 真实客户端 IP（Cloudflare 代理场景）。"""
def rate_limit(ip: str = Depends(get_client_ip), limit: int = settings.activation_rate_limit_per_ip) -> None:
    """简易内存计数（仅单 worker 有效；多 worker / Cloud Run 部署须换 Redis 或按 DB 计数）；超限 429。"""
def verify_paddle_signature(raw_body: bytes, signature_header: str) -> bool:
    """委托 security.verify_paddle_signature（见 13.9 core/security）。"""
```

### `migrations/`（Alembic）

```bash
alembic revision -m "init"   # 生成 6 张表 + 索引
alembic upgrade head
```
- `alembic.ini`：`sqlalchemy.url = %(DB_URL)s`（从 env 注入，不写死）
- `migrations/env.py`：绑定 `Base.metadata`，`run_migrations_online()` 读 `settings.db_url`
- `migrations/script.py.mako`：标准模板

### `requirements.txt` / `pyproject.toml`（依赖锁定）

```text
fastapi==<pin>
uvicorn[standard]==<pin>
sqlalchemy==2.*            # 避免原生 SQL 方言写死
alembic==<pin>
pydantic==2.*; pydantic-settings==<pin>
PyJWT==<pin>
argon2-cffi==<pin>        # 口令哈希（argon2id）；passlib 已停止维护，直接用 argon2-cffi
cryptography==<pin>        # Ed25519
python-dotenv==<pin>
pytest==<pin>; httpx==<pin>   # 测试 + TestClient
# 邮件：resend / boto3(SES) / postmark 三选一
```

### `backend/.env.example`（仅字段，无真实值）

```text
APP_ENV=production
FRONTEND_ORIGINS=https://video2text.dpdns.org
DB_URL=sqlite:///./app.db
JWT_SECRET=
LICENSE_ED25519_PRIVATE_KEY=
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_ENVIRONMENT=sandbox
MAIL_API_KEY=
MAIL_FROM=licensing@video2text.dpdns.org
ACTIVATION_RATE_LIMIT_PER_IP=20
```

### `Dockerfile` / `docker-compose.yml`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
```
- `docker-compose.yml`：后端 +（可选）Postgres；**仅用于生产部署**；本地开发直接运行 uvicorn（见 [14 §14.6.1](./14-ops-runbook.md)）；挂载 `.env` 与数据卷。
- 生产镜像与 `alembic upgrade head` 组合进部署流程（见 [14-ops-runbook.md](./14-ops-runbook.md) §14.6）。

---

## 13.10 前后端契约（P3 联调用）

| 项 | 约定 |
| --- | --- |
| 授权载荷 | 见 [08 §8.1](./08-license-design.md)；`sign_license_payload` 输出 base64(`payload|ed25519_sig`) |
| 激活端点 | `POST /license/activate`，桌面端上报 `machine_id_hash`（本地先哈希） |
| 复核端点 | `POST /license/verify`，周期到 `recheck_after` 触发 |
| 撤销生效 | 退款 Webhook -> `License.revoked_at`；桌面端下次复核失效（受 14 天宽限） |
| 版本兼容 | 桌面端在请求头带 `X-Client-Version`；后端对未知主版本返回 `410` 提示升级 |
| 公钥分发 | Ed25519 **公钥仅内置于桌面端仓库**（本仓库不内置公钥源码；后端如需自校验按需由私钥派生），通过桌面端发版内联；本仓库仅保管私钥。私钥轮换需桌面端同步发版更新内置公钥，详见 [14 §14.6.4](./14-ops-runbook.md) |

---

> 本文件与 `05`（目录）、`06`（实现要点）、`08`（License）配套；编码时以本文件签名为准，发现偏差回写本文件。

---

## 13.11 编码顺序建议（落地路径）

> 按阶段推进，每阶段产出可独立验证；方法签名以本文件为准，方法体留待编码。

### P0 · 骨架
1. `astro.config.mjs` + `package.json` + `tsconfig.json` + `.nvmrc` + `src/env.d.ts`
2. `src/i18n/{ui,en,zh,utils}.ts`（字典 + 解析）
3. `src/lib/{env,github,seo}.ts`
4. `src/components/*` + `MobileMenu.tsx` + `src/layouts/BaseLayout.astro`
5. `src/lib/i18n-paths.ts` + `[lang]/index.astro` 空壳（不建 `src/pages/index.astro`）；验证 `npm run dev` 双语可跑、`/` → `/en`

### P1 · 静态站点
6. 页面：`features/download/docs/blog/pricing/contact/privacy/terms/refund/404`
7. `src/content/config.ts` + `docs/`、`blog/` 样例
8. `src/scripts/{download-client,menu}.ts` + `global.css` 设计令牌
9. CI（check/lint/build/死链/Lighthouse）+ Cloudflare Pages 部署

### P2 · 内容与推广
10. 中文全量同步、SEO 全量（sitemap/OG/JSON-LD）、Release 动态版本（构建期注入 + 定时重建）、`/changelog` 日志页（Release 列表注入）
11. 文档原生维护（见 §13.8 文档维护约定：无同步脚本，人工整理落地）

### P3 · 后端
12. `backend/app/core/{config,db,security,logging}.py`
13. `backend/app/models/*` + `schemas/*` + `migrations/`（Alembic init）
14. `backend/app/services/{license,payment,mail}_service.py`
15. `backend/app/api/{health,users,license,webhooks,_deps}.py` + `main.py`
16. `requirements.txt` / `Dockerfile` / `.env.example`
17. `backend/tests/`（验签、状态机、幂等必过）+ GCP 部署

### P4 · 全渠道
18. `alipay.py` 回调 + `/account` 自助换机/退款状态

---

## 13.12 图片资源生成（`scripts/generate_icon.py`，Python + Pillow）

> 项目当前**不准备任何图片素材**；所有图片资源（favicon、OG、Logo、社交卡、占位图）统一由 Python 脚本基于 **Pillow** 程序化生成，保证风格一致、可复现、作为纳入版本控制前的唯一来源。方法体留待编码，此处只定义方法与参数。

### 设计要点
- 单一入口 `scripts/generate_icon.py`：`python scripts/generate_icon.py` 重新生成全部图片到 `public/`（favicon 根目录、`og/` 子目录等），供 Astro 静态引用。
- **每个图片有独立参数**：尺寸、文案、主色/背景色、字体、输出路径，由 `ImageSpec` 数据类描述，避免散落硬编码。
- 依赖：`Pillow`（字体用本地字体文件，避免跨平台字体差异）；不依赖网络。
- 真实产品截图（桌面端界面）非生成范畴，待提供后放入 `public/images/` 并替换占位图。

### 方法设计（仅签名与功能，不写实现）

```python
from dataclasses import dataclass
from PIL import Image, ImageDraw, ImageFont

@dataclass
class ImageSpec:
    name: str                                     # 资源名（用于选择生成逻辑）
    width: int; height: int                        # 每张图独立尺寸
    bg_color: str | tuple[int, int, int]
    fg_color: str | tuple[int, int, int]
    text: str; subtitle: str = ""                 # 每张图独立文案
    font_path: str | None = None                  # 独立字体
    output: str                                    # 相对 public/ 的输出路径

def render(spec: ImageSpec) -> Image.Image:
    """通用绘制：背景 + 安全边距 + 居中标题/副标题；被下列方法复用。"""

def generate_favicon(spec: ImageSpec) -> None:
    """按 spec 生成 favicon（多尺寸 png + .ico），主视觉为品牌字标。"""
def generate_logo(spec: ImageSpec) -> None:
    """生成 Logo（方块/横版由尺寸参数决定），色块 + 文字。"""
def generate_og_image(spec: ImageSpec) -> None:
    """生成 1200×630 OG/Twitter 卡片：标题 + 副标题 + 品牌色。"""
def generate_social_card(spec: ImageSpec) -> None:
    """生成社交平台预览卡（尺寸/文案按平台参数独立）。"""
def generate_placeholder(spec: ImageSpec) -> None:
    """生成产品截图占位图（带标注，真实截图就位后替换）。"""

def main() -> None:
    """读取 specs（内联常量或 yaml），逐一 render 并写出 public/。"""
```

### 图片清单（示例 specs）

| 图片 | 尺寸 | 独立参数要点 |
| --- | --- | --- |
| `favicon` | 32/64/128/256 + `.ico` | 品牌字标、主色 |
| `og/home` | 1200×630 | 首页标题/副标题、OG 主色 |
| `og/pricing` | 1200×630 | 定价页文案、主色 |
| `logo` | 按 spec | 方块/横版、文字 |
| `placeholder/*` | 按 spec | 截图占位标注 |

> 生成脚本独立于前端构建（不进 `astro build` 产物）；CI 可在部署前运行以保证资源最新。

---

> 跨仓库契约（P3 联调）：激活/复核端点、Ed25519 载荷、设备指纹哈希、版本头，见 §13.10 与 [08-license-design.md](./08-license-design.md)。
