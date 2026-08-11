# 04 · 页面布局设计

> 模块定位：逐页面定义信息架构、布局区块、组件清单与响应式行为。
> 上级索引：[00-overview.md](./00-overview.md)

## 4.1 信息架构（站点地图）

```
/                         首页（Hero + 特性 + 工作流 + 下载 CTA + 信任背书）
/en, /zh                  语言子路径（默认 /en）
/en/features, /zh/features   功能特性（详细分点 + 截图/动图）
/en/docs, /zh/docs           文档入口（Astro content collections）
/en/docs/getting-started     快速开始
/en/docs/configuration       配置说明（模型、API Key、GPU）
/en/docs/online-models       在线模型接入（含 BYOK 自带 Key 指引）
/en/docs/incremental         增量模式
/en/blog, /zh/blog           博客/教程列表
/en/blog/[slug]              博客详情
/en/pricing, /zh/pricing     定价（Free 桌面版 + Pro 增值）
/en/contact, /zh/contact     联系/反馈
/en/privacy, /zh/privacy     隐私政策（合规必备）
/en/terms, /zh/terms         服务条款 / EULA（Paddle 入驻必备）
/en/refund, /zh/refund       退款政策（Paddle 入驻必备）
/en/changelog, /zh/changelog 版本更新日志（可由 Release 自动生成）
404                         多语言 404 页
（后期）/en/account          用户中心（登录 / License 管理，需后端）
（后期）/en/checkout         收银台（MoR 跳转 / 支付宝，需后端）
```

> i18n 说明：
> - 所有页面均置于 `/en`、`/zh` 子路径下；`prefixDefaultLocale: true`，默认语言也带前缀，利于 SEO 与 hreflang 一致。
> - 非前缀路径（如 `/features`）本期不存在（会 404）：所有内链一律带 `/[lang]` 前缀。
> - `/` 的处理（**已定方案**）：纯静态托管无法做服务端 Accept-Language 协商，本期采用 **方案① Astro `redirects` 生成静态 `/index.html` 跳转到 `/en`**（默认英文，最简单、零函数成本）。Astro static 模式下 `redirects: {'/': '/en'}` 会输出 `/index.html` 的 meta-refresh + JS 跳转；为保证 SEO 友好，同时在 Cloudflare Pages 层配置 **Serving 错误/重定向规则** 将 `/` 301 到 `/en`（见 [09 §9.2](./09-deployment.md)、[14 §14.5](./14-ops-runbook.md#145-前端部署cloudflare-pagesa-方案推荐)）。
>   - 备选方案②（Cloudflare Pages Function 读 `Accept-Language` 做 302 协商）本期**不采用**，待 P2 如需更友好协商再评估；若采用需补充 `functions/` 代码。
> - 各页必须输出 **hreflang 交替链接 + 自引用 canonical**（见 [06 §6.3](./06-implementation.md)）。

## 4.2 首页（Landing）布局

1. **Top Nav**
   - Logo + 导航（Features / Docs / Blog / Pricing / Contact）
   - 语言切换（EN/ZH）
   - GitHub 星标按钮
   - 响应式：移动端折叠为抽屉菜单（hamburger）
2. **Hero**
   - 英文价值主张："Local, private audio & video transcription and summarization"
   - 主 CTA：Download（指向 GitHub Releases 下载最新桌面端）；副 CTA：View Docs
   - 产品截图 / 动图（Autoplay muted loop，注意体积）
3. **特性卡片（6 个，对应 §2.3 卖点）**
   - Local & Private / GPU Accelerated / Multi-language / AI Summary / Flexible Models / Desktop & CLI
   - 每卡：图标（lucide）+ 标题 + 一句说明 + 可选"了解更多"链接
4. **工作流（Workflow）**
   - 步骤：选择本地文件 → 提取音频 → faster-whisper 转写 → 本地大模型总结 → 导出（txt/json/srt 等）
   - 用横向步骤条（移动端纵向）
   - 文案避免用"上传（upload）"，本地工具用"导入/选择本地文件"，与隐私定位一致
5. **对比 / 信任背书**
   - 隐私安全、开源、性能数据（对照表，见 02 §2.4）
6. **下载 CTA 区块**
   - 主下载按钮直接指向 GitHub Releases（`https://github.com/<repo>/releases`），由桌面端仓库分发安装包（无独立下载页）
7. **Footer**
   - 版权、链接、社交、隐私政策、服务条款、退款政策
   - 本期海外站点无 ICP 备案号；备案信息占位仅国内站点使用

## 4.3 功能页（/features）

- 顶部 H1 + 简介
- 各卖点详细分点（对应 §2.3），配截图/动图
- 末尾 CTA 回到下载 / 文档

## 4.4 下载入口（无独立下载页）

> 已移除独立 `/download` 页面与独立 FAQ 页面。下载入口统一为指向 GitHub Releases 的主 CTA（Header / Hero / 定价页免费版 / 通用 CTA 区块），由桌面端仓库分发 Windows 安装包（x64 / arm64，含安装版与便携版）。常见问题（含系统要求）集中在定价页内 FAQ 区块（见 §4.5）。

## 4.5 定价页（/pricing，前期静态占位）

- **Free（桌面版）**：本地转写、GPU 加速、基础总结 —— 永久免费
- **Pro（买断制 one-time）**：**$9.9**，权益聚焦**本地可验证、无持续云成本**的能力：
  - 批量与增量处理增强、优先支持、License 多设备激活（默认 2 台，可自助换机）
  - 高级本地导出/格式、早期功能体验
  - **不含"开发者代付的在线模型额度"**：在线模型继续走 BYOK（用户自带 Key），详见 [02 §2.3](./02-product-positioning.md)
- 文案强调："一次性买断 $9.9，由 Paddle 托管收银台处理付款、开票与税务合规，无需自建支付"
- 后端就绪后 `/checkout` 跳转 Paddle 托管收银台（Checkout）
- 常见问答（退款政策、设备数、系统要求）
- 关联：[08-license-design.md](./08-license-design.md)、[11-tbd.md §11.2](./11-tbd.md)（退款阈值待确认）

## 4.6 文档与博客（/docs、/blog）

- `/docs`：Astro Content Collections 渲染 MD/MDX
- `/blog`：列表 + `[slug]` 详情；后期可选 Giscus 评论
- 文档与博客原生维护于本站 `src/content`（见 06 §6.4），不从外部仓库同步

## 4.7 合规页（/privacy、/terms、/refund、/contact）

- **/privacy**：隐私政策，明确"桌面端本地离线、不上传音视频"；Cookie/分析说明（若启用）
- **/terms**：服务条款 / EULA（许可范围、免责声明），**Paddle 入驻通常要求**
- **/refund**：退款政策（14 天窗口等，见 [08 §8.3](./08-license-design.md)），**Paddle 入驻通常要求**
- **/contact**：联系/反馈（前期指向 GitHub Issues / 邮箱，无需后端）

## 4.8 统一组件清单

| 组件 | 职责 |
| --- | --- |
| `Header.astro` | 响应式 + 移动端抽屉菜单 + 语言切换 + GitHub 星标 |
| `Footer.astro` | 版权、链接、社交、隐私/条款/退款、备案信息（仅国内站点） |
| `Hero.astro` | 首页主视觉与双 CTA |
| `FeatureCard.astro` | 特性卡片（图标 + 标题 + 说明） |
| `Workflow.astro` | 工作流步骤条 |
| `CTASection.astro` | 通用引导区块（双 CTA：Download→GitHub Releases / Learn more→Docs） |
| `LangSwitch.astro` | 语言切换（维护当前路径的 `/en`↔`/zh` 映射，保持同页跳转） |
| `SEOHead.astro` | 统一注入 title/description/OG/canonical/hreflang/JSON-LD |
| `PricingCard.astro` | 定价卡片（预留 Pro 方案与 checkout 跳转） |

## 4.9 响应式与可访问性

- 断点：移动优先，桌面 ≥1024px 展开完整导航
- 语义化标签、alt 文本、键盘可达、对比度达标（WCAG AA）
- 动图提供 `prefers-reduced-motion` 降级

## 4.10 设计令牌与品牌一致性

- 在 `global.css` / Tailwind 主题中定义统一设计令牌：主色（建议与桌面端品牌色一致）、灰度、圆角、阴影、间距、字体栈
- 字体子集化，避免大体积字体阻塞渲染；系统字体栈作兜底
- 组件级设计约定（间距比例、按钮尺寸、卡片高度）统一，避免逐页硬编码样式

## 4.11 性能预算

- Lighthouse 目标：Performance ≥ 95、SEO = 100、Accessibility ≥ 95、Best Practices ≥ 95
- 关键图片设置 `width`/`height` 与 `loading="lazy"`（首屏图 `eager`），避免 CLS
- 动图/截图压缩，提供 `webp`/`avif`；首页首屏控制在合理体积
