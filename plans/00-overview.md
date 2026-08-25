# video2text-web 官网建设方案 · 总览索引

> 创建日期：2026-08-11
> 作者：Kilo
> 状态：草案（已确认关键决策，待评审）

本文件是 `video2text-web` 官网建设方案的**总览与导航**。完整的详细设计已拆分为若干模块文件，便于分头评审与后续落地。各模块相互独立、可单独更新。

## 模块清单

| 编号 | 文件                                                     | 主题                                              |
| ---- | -------------------------------------------------------- | ------------------------------------------------- |
| 00   | [00-overview.md](./00-overview.md)                       | 本文件：背景、目标、已确认关键决策                |
| 01   | [01-background.md](./01-background.md)                   | 背景与目标、关键决策详解                          |
| 02   | [02-product-positioning.md](./02-product-positioning.md) | 产品定位、卖点、目标用户、差异化                  |
| 03   | [03-tech-stack.md](./03-tech-stack.md)                   | 技术选型（前端 / 后端 / 选型理由）                |
| 04   | [04-pages-layout.md](./04-pages-layout.md)               | 信息架构与逐页面布局设计                          |
| 05   | [05-code-architecture.md](./05-code-architecture.md)     | 前后端代码目录结构与职责                          |
| 06   | [06-implementation.md](./06-implementation.md)           | 关键实现要点（下载、SEO、i18n、支付、隐私）       |
| 07   | [07-roadmap.md](./07-roadmap.md)                         | 分阶段实施路线与里程碑                            |
| 08   | [08-license-design.md](./08-license-design.md)           | License 设计提案（买断制、激活、退款、数据模型）  |
| 09   | [09-deployment.md](./09-deployment.md)                   | 发布与部署架构（GitHub / Cloudflare Pages / Oracle Cloud） |
| 10   | [10-risks.md](./10-risks.md)                             | 风险与注意事项                                    |
| 11   | [11-tbd.md](./11-tbd.md)                                 | 待确认事项                                        |
| 12   | [12-content-seo.md](./12-content-seo.md)                 | 内容营销与 SEO 增长（获客）                       |
| 13   | [13-code-design-detail.md](./13-code-design-detail.md)   | 代码设计详细（逐文件类/方法/Props 签名）          |
| 14   | [14-ops-runbook.md](./14-ops-runbook.md)                 | 本地测试/部署/发布/上线详细手册                   |

## 一句话摘要

新建独立官网项目 `video2text-web`：以 Astro + Tailwind 静态站点先行（海外 SEO、下载、文档、博客），Python + FastAPI 后端后期启用（Paddle MoR 收款 + License 校验）。品牌 `video2text`，生产域名固定为 `video2text.dpdns.org`（Cloudflare 托管，免备案）；英语优先、子路径 i18n。

## 评审需重点决策的三件事（P2 前拍板，不阻塞 P0/P1）

> 以下三项影响**对外承诺与 P3 收款**，但**不阻塞 P0/P1 的静态站点编码**（前端可先做）。归属"待确认事项"，见 [11-tbd.md](./11-tbd.md)。

1. **Pro 权益边界**：必须为"无持续云成本"项；在线模型走 BYOK（用户自带 Key），不含开发者代付额度，否则 $9.9 买断不可持续。见 [02 §2.3](./02-product-positioning.md)。
2. **开源与授权强制力**：若桌面端开源，纯客户端 Pro 开关可被绕过，需先定策略再对外承诺。见 [08 §8.7](./08-license-design.md)。
3. **MoR 入驻**：免费子域可能被部分 MoR（如 Paddle）审核拒收；Paddle 对中国大陆卖家可行性需验证，备好备选 MoR（Lemon Squeezy / Creem / Polar）。见 [11 §11.1](./11-tbd.md)。

## 已确认关键决策（速览）

| 决策项      | 结论                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| 域名与品牌  | `video2text`；生产固定使用 `video2text.dpdns.org`（Cloudflare 托管，免备案） |
| 地域 / 备案 | 先海外站点，国内站点后期单独规划（不复用当前域名/托管）                      |
| 文案语言    | 英语优先，中文随后同步                                                       |
| i18n 路由   | 子路径 `/en`、`/zh`，默认 `/en`                                              |
| 支付        | 海外 MoR 优先，选 **Paddle**；后期补充国内支付宝                             |
| 付费模式    | 仅桌面版 + Pro 增值，不提供在线转写 SaaS                                     |
| Pro 定价    | 买断制（one-time）**$9.9**                                                   |

> 详细决策背景与 MoR / 域名说明见 [01-background.md](./01-background.md)。
