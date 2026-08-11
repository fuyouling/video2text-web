# 11 · 待确认事项

> 模块定位：汇总尚未拍板、需在对应阶段启动前确认的关键项。
> 上级索引：[00-overview.md](./00-overview.md)

## 11.1 MoR（Paddle 等）商户入驻（P3 启动前预备）

- 尚未评估入驻材料（身份证明 / 税务表单 W-8BEN）与周期。
- **中国大陆个人卖家能否通过 Paddle 入驻存不确定性**，需提前验证；若受阻，备选 MoR：Lemon Squeezy、Creem、Polar（均为 MoR，接口形态类似，可抽象在 `payment_service`）。
- 建议：P2 阶段即启动首选 MoR 账户申请，避免阻塞 P3 收款上线。
- 关联：[08 §8.8](./08-license-design.md)、[09 §9.4](./09-deployment.md)、[10 §10.2](./10-risks.md)。

## 11.2 License / Pro 策略（待确认后落地）

- **开源策略**：`video2text` 桌面端是否开源、以何许可证？决定 Pro 权益能否强制（见 [08 §8.7](./08-license-design.md)、[10 §10.4](./10-risks.md)）。
- **Pro 权益清单**：必须限定为"无持续云成本"项（批量/增量增强、多设备 License、优先支持、高级本地导出等）；**不得含"开发者代付的在线模型额度"**（违反买断模型）。
- 设备上限默认 2 台是否足够？是否需要分层（如 Pro+/团队）？
- 退款窗口：建议 14 天无理由（写入 `/refund`）；是否设"激活次数上限"作退款条件——建议不设硬阈值，避免争议。
- 机器指纹 `machine_id` 取法与稳定性（Windows，跨重装/硬件变更）需技术验证。
- License 激活接口的限流/风控阈值。
- 关联：[08-license-design.md](./08-license-design.md)、[02 §2.3](./02-product-positioning.md)。

## 11.3 域名策略（已固定）

- 生产域名固定为 **`video2text.dpdns.org`**（Cloudflare 托管），不购买独立域名。
- 接受免费子域限制，配合缓解：邮件通过 Cloudflare Email Routing / 事务邮件服务商配置 DNS；MoR 以 Paddle 为首选，若审核拒绝则切换 Lemon Squeezy / Creem / Polar。
- 国内站点：后期单独域名 + 备案，不与海外域名混用；需评估备案主体。
- 相关风险跟踪见 [10 §10.4](./10-risks.md)。

## 11.4 内容维护

- `video2text-web` 文档/博客**原生维护于本站**，不从外部仓库自动/半自动同步。
- 如需复用既有资料，采用人工整理落地，明确负责人与频率。

## 11.5 其他开放问题

- 是否需要博客评论（Giscus）？上线时间？
- 是否启用网站分析？选 Plausible / Cloudflare Web Analytics（隐私友好）？
- 是否需要在首页展示 GitHub 星标实时数？（需 API，注意限流）
- 定价是否区分区域（如国内人民币定价）？本期默认统一 $9.9。
- 桌面端是否要公开"开源/源码"作为信任背书？若公开，需同步更新 Pro 授权策略（§11.2）。
- 内容营销与 SEO 计划（博客选题、外链、海外社区分发）建议单独成篇（见 [12-content-seo.md](./12-content-seo.md)）。
