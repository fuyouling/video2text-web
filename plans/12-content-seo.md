# 12 · 内容营销与 SEO 增长

> 模块定位：补充"官网建好之后如何获客"这一在原方案中缺失的环节。技术站点只是基础，增长靠内容与分发。
> 上级索引：[00-overview.md](./00-overview.md)

## 12.1 定位

- 静态站点 + 完美 SEO 技术配置只是"可被收录"的前提，不等于有流量。
- 面向海外、隐私敏感、一次性付费人群，**内容营销（教程/对比/长尾关键词）** 是主要低成本获客手段。

## 12.2 关键词与选题方向

| 类型 | 示例选题（英文优先） | 意图 |
| --- | --- | --- |
| 工具替代 | "offline alternative to \<cloud transcription tool\>" | 高转化，抓隐私敏感用户 |
| How-to | "how to transcribe video locally with GPU" | 教程引流 |
| 隐私向 | "transcribe audio without uploading to the cloud" | 契合核心卖点 |
| 技术向 | "faster-whisper large-v3-turbo setup on Windows" | 抓技术用户，长尾 |
| 对比 | "local vs cloud transcription: privacy & cost" | 中立对比，建立信任 |
| 场景 | "transcribe lectures / meetings / interviews offline" | 场景化落地页 |

- 中文选题同步，但以英文为 SEO 主线。
- 每篇博客对应 1 个主关键词 + 若干长尾，内链到 `/features`、`/download`、相关 `/docs`。

## 12.3 内容节奏（建议）

- P2 起：首发 3–5 篇奠基内容（快速开始、隐私对比、GPU 配置、场景教程）。
- 之后保持每 1–2 周 1 篇；优先复用桌面端已有文档改写为面向搜索的教程。
- 每次桌面端发版写一篇 changelog/发布博客，制造更新信号。

## 12.4 分发渠道

- 开发者/隐私社区：Reddit（r/selfhosted、r/privacy、相关兴趣版）、Hacker News（Show HN）、Product Hunt。
- 中文：少数派、V2EX、B站/知乎教程（后期国内站点配合）。
- GitHub README 顶部加官网链接，形成双向流量。
- 遵守各社区自我推广规则，避免硬广被封。

## 12.5 转化路径与埋点

- 主转化：博客/功能页 → `/download`（免费）→ 使用后 → `/pricing` Pro。
- 关键页放清晰 CTA（Download / View Pricing）。
- 用隐私友好分析（Cloudflare Web Analytics / Plausible）看：下载点击、pricing 访问、来源渠道；不追踪个人身份。
- 后期（有后端）可看 checkout 转化漏斗（Paddle 面板 + 自有订单表）。

## 12.6 度量指标

| 阶段 | 关注指标 |
| --- | --- |
| P2 | 收录页数、自然流量、下载点击数、跳出率 |
| P3+ | pricing→checkout 转化率、付费数、退款率、渠道 ROI |

## 12.7 与其他模块关系

- 技术 SEO（hreflang/canonical/sitemap/JSON-LD）见 [06 §6.2/§6.3](./06-implementation.md)。
- 博客/文档结构见 [04 §4.6](./04-pages-layout.md)、[05 §5.1](./05-code-architecture.md)。
- 分析工具选型见 [03 §3.1](./03-tech-stack.md)。
