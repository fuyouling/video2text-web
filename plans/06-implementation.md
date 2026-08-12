# 06 · 关键实现要点

> 模块定位：列出落地时最易踩坑或需提前决策的技术实现点，给出方案与注意事项。
> 上级索引：[00-overview.md](./00-overview.md)

## 6.1 GitHub Releases 动态数据（供 /changelog）

> 注：独立 `/download` 页面已移除，下载改由指向 GitHub Releases 的主 CTA 完成；下方 GitHub Releases 拉取逻辑现服务于 `/changelog` 版本日志页（见 [13 §13.4](./13-code-design-detail.md)）。

- **数据源**：`GET https://api.github.com/repos/<owner>/<APP_REPO>/releases/latest`（`<APP_REPO>` 由构建期 `PUBLIC_RELEASE_REPO` 注入，只指向应用分发仓库，与本站代码无关）
- **兜底版本**：本站常量 `APP_VERSION` = `1.0`（起始值，与桌面端版本完全解耦；仅 GitHub API 不可达时的静态兜底，后续按需人工更新）
- **限流注意**：GitHub API 匿名限流 **60 次/小时/IP**，纯静态站点在客户端逐次请求会很快耗尽或被墙，**不可**每次访问都 fetch。
- **推荐方案（构建期注入 + 定时重建）**：
  1. 构建期（Node/`astro:env`）请求一次 Releases，解析各平台资产（Windows exe/portable，按 x64/arm64 分流），注入 /changelog 版本日志页；
  2. 用 **定时重建** 保持新鲜：Cloudflare Pages Deploy Hook + GitHub Actions `schedule`（如每日）触发本站重建；
  3. 客户端可选二次 `fetch` 刷新最新号，**必须**有失败兜底（回退到构建期版本 + "查看所有版本"链接）。
- **平台检测**：优先 `navigator.userAgentData`（`getHighEntropyValues` 拿架构），回退解析 `userAgent`；**勿用已废弃的 `navigator.platform`**。Windows 的 x64/arm64 可由 UA 辅助判断，仍提供手动选择更稳妥。
- **资产命名约定**：与**应用分发仓库** Release 的产物命名约定保持一致（正则匹配平台/架构），命名变更需同步更新解析逻辑。

## 6.2 SEO / OG

- 由 `SEOHead.astro`（被 `BaseLayout` 引用）统一注入 `title` / `description` / OG / Twitter 卡片，每页可覆盖。
- `<html lang>` 随子路径（`en`/`zh`）切换。
- **canonical**：每页输出自引用 canonical（含语言前缀的绝对 URL）。
- **hreflang**：每页输出 `en`/`zh` 交替链接 + `x-default`（指向 `/en`），确保多语言不被判重复内容。
- 用 `@astrojs/sitemap` 生成带 i18n 的 sitemap；`robots.txt` 放行并声明 sitemap 位置。
- 结构化数据（JSON-LD）：`SoftwareApplication`（含 `operatingSystem`、`applicationCategory`、`offers` 价格）+ 文章页 `Article`。
- OG 图：为首页/关键页准备 1200×630 图片，放 `public/og/`。
- **域名一致性**：所有绝对 URL 使用统一生产域名 `https://video2text.dpdns.org`（通过 `PUBLIC_SITE` 注入，见 [09 §9.3](./09-deployment.md)），避免混用子域/路径导致权重分散。

## 6.3 i18n（子路径）

> 本方案为 **video2text-web 官网项目自有**的 i18n 设计，与桌面端 `video2text` 项目解耦，不引用、不依赖桌面端任何约定（与本仓库"独立工程"原则一致，见 [14 §14.0](./14-ops-runbook.md)）。

### 设计原则

- **官网独立维护多语言文案**：所有 UI 文案、页面内容、SEO 文案均由本站 `src/i18n` 与 `src/content` 管理，**不与桌面端共享术语表或字典文件**。
- **英语优先、中文同步**：默认语言 `en`，中文 `zh` 为同等重要的第二语言；后期如需扩展语言再加 `locales`。
- **可发现、可维护**：术语在本节集中定义，供本站文案与组件统一引用，避免逐页硬编码造成语言间不一致。

### 语言与路由

- 子路径 i18n：`/en`、`/zh`，默认 `/en`（`prefixDefaultLocale: true`）。
- `/` 处理方式见 [04-pages-layout.md §4.1](./04-pages-layout.md)（Astro redirects + Cloudflare Pages 301 到 `/en`）。
- `LangSwitch` 维护当前路径的 `/en`↔`/zh` 映射，切换语言保持同一页面而非跳首页。
- hreflang 交替链接 + 自引用 canonical 见下文。

### 文案组织

- UI 文案：类型化字典 `src/i18n/{ui,en,zh,utils}.ts`，`en` 为完整基准集，`zh` 可部分；缺失键回退 `en` 并由 CI 提示（见 [13 §13.2](./13-code-design-detail.md)）。
- 内容集合（blog/docs）：统一使用 frontmatter `lang` 字段（不分目录），列表页只展示当前语言（见 [05 §5.1](./05-code-architecture.md)、[13 §13.7](./13-code-design-detail.md)）。

### 官网术语统一表（本站自有）

> 仅约束官网文案，不试图与桌面端对齐（桌面端术语由桌面端仓库自行管理）。

| 中文             | English                 | 备注                                                  |
| ---------------- | ----------------------- | ----------------------------------------------------- |
| 转写             | transcription           | 不译作 "convert"                                      |
| 总结             | summary / summarization |                                                       |
| 增量模式         | incremental mode        |                                                       |
| 批量处理         | batch processing        |                                                       |
| 本地离线         | Local & Private         | 品牌核心心智，全站统一大写                            |
| 在线模型（BYOK） | online models (BYOK)    | 指"用户自带 Key"，仅用于说明桌面端能力，不进 Pro 权益 |
| 买断             | one-time / buy once     | 与订阅制（subscription）对比                          |
| 隐私             | privacy                 |                                                       |

### 与桌面端的关系（解耦声明）

- 官网描述桌面端能力时，**不引用桌面端源码、术语表或版本**；相关表述以官网文案为准，桌面端实际行为差异由产品/文档负责人同步。
- 若未来需要"桌面端术语 ↔ 官网术语"对齐，应作为**人工同步事项**记录在 [11-tbd.md §11.4](./11-tbd.md)，不以文件/代码耦合方式实现。

## 6.4 文档维护（本站独立）

- 本站文档（博客/教程/使用指南）**原生维护于本仓库** `src/content/docs` 与 `src/content/blog`，不引用、不同步任何外部仓库（含桌面端 `video2text` 仓库），避免跨仓库耦合与内容漂移。
- 如需复用既有资料，采用**人工整理后落地**到本站内容集合的方式，而非自动/半自动同步脚本拉取。
- 内容集合 schema（含 `lang` 字段）见 [05-code-architecture.md](./05-code-architecture.md) 与 [13-code-design-detail.md](./13-code-design-detail.md)。

## 6.5 收款预留（Paddle 优先）

- `/pricing` 先静态呈现 Free + Pro（$9.9 买断）。
- 后端就绪后 `/checkout` 跳转 **Paddle 托管收银台**（Checkout / Overlay）。
- Paddle Webhook 回调**验签 + 幂等**后落库（Order / License）并签发 License Key，通过事务邮件交付。
- License Key 通过**邮件交付**（用户下单填邮箱）；`/account` 为后期能力，早期无需登录也能拿到 Key。
- 后期补充支付宝（国内）回调。
- 备选 MoR（若 Paddle 入驻受阻）：Lemon Squeezy / Creem / Polar，接口形态类似，抽象在 `payment_service`。

## 6.6 隐私合规

- 首页突出 "Local & Private"。
- 必须提供 `/privacy` 隐私政策 + `/terms` 服务条款 + `/refund` 退款政策（后两者为 Paddle 入驻常见要求）。
- 明确声明"桌面端本地离线、不上传音视频"；同时如实说明"**在线模型/BYOK 场景下音频/文本会发送到用户配置的第三方端点**"，不夸大绝对离线。
- 若启用分析（Cloudflare Web Analytics / Plausible 等隐私友好方案），在隐私政策披露；尽量无 Cookie，避免 Cookie 横幅。

## 6.7 性能与资源

- 动图/截图压缩，提供 `webp`/`avif`；动图 `prefers-reduced-motion` 降级或改用静态图 + 播放按钮。
- 关键图片设置 `width/height` 避免 CLS；首屏图 `eager`，其余 `lazy`。
- 字体子集化，`font-display: swap`，系统字体栈兜底，避免大体积字体阻塞渲染。
- Lighthouse CI 作为性能门槛（见 [03 §3.1.3](./03-tech-stack.md)）。

## 6.8 安全红线

- 前端零密钥；所有付费/授权敏感逻辑后端完成。
- 不暴露任何 `.env`、密钥、License 签名私钥、生成算法于前端或仓库。
- 后端对 Webhook 强制验签 + 幂等；对 License 激活接口限流/风控（见 [08](./08-license-design.md)）。
- 依赖与产物扫描（可选 `npm audit` / Dependabot），CI 中不打印敏感变量。
