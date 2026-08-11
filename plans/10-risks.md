# 10 · 风险与注意事项

> 模块定位：列出主要风险及缓解措施，前置规避。
> 上级索引：[00-overview.md](./00-overview.md)

## 10.1 安全红线

- **静态托管无法保护需鉴权逻辑**：付款 / License / 密钥必须走后端，前端严禁硬编码密钥。
- 任何 `.env`、Paddle 密钥、JWT 密钥、License 签名私钥、生成算法不得进入仓库或前端 bundle。
- 启用 Cloudflare WAF / Bot 防护 / 速率限制，保护 `api.video2text.dpdns.org` 与后期 `/checkout`。
- Paddle Webhook 必须验签 + 幂等；仅信任 Paddle 官方来源 IP/签名。

## 10.2 合规风险

- 域名、隐私政策、MoR 商户资质需提前规划。
- 海外 MoR（Paddle）已解决 VAT/税务，但**入驻需材料**（身份证明 / 税务表单 W-8BEN）与周期需预留；**中国大陆个人卖家能否通过 Paddle 入驻存不确定性**，需准备备选 MoR（Lemon Squeezy / Creem / Polar，见 [11 §11.1](./11-tbd.md)）。
- 国内支付宝需另行合规（主体、备案、资质），不并入海外流程。
- `/privacy` + `/terms` + `/refund` 三页齐备（后两者为 Paddle 入驻常见要求）；明确"桌面端本地离线、不上传音视频；在线模型/BYOK 除外"。
- 若启用分析，用无 Cookie 方案并在隐私政策披露。

## 10.3 范围风险

- **不提供在线转写 SaaS**：后端仅服务于"桌面版 Pro 授权"相关逻辑，范围收敛、风险可控。
- 避免后端范围蔓延（如用户论坛、云存储），保持 License/支付/用户系统最小集。

## 10.4 业务模型风险（高优先级）

- **"在线模型额度"与"买断制"冲突**：若 Pro 含"开发者代付的云端模型额度"，一次性 $9.9 无法覆盖无限持续云成本，商业模式不可持续。Pro 权益须限定为无持续云成本项，在线模型走 BYOK（见 [02 §2.3](./02-product-positioning.md)、[08 §8.8](./08-license-design.md)）。
- **开源下授权可绕过**：若桌面端开源，纯客户端 Pro 开关可被移除重编译（见 [08 §8.7](./08-license-design.md)）。需先决策开源策略与 Pro 强制力的取舍，再对外承诺 Pro 权益。
- **免费子域限制（已接受）**：`dpdns.org` 用于付费产品可能影响专业度、邮件 SPF/DKIM 配置受限、且可能被 MoR 审核拒绝（见 [01 §1.3.2](./01-background.md)、[11 §11.3](./11-tbd.md)）。缓解措施：Cloudflare Email Routing 改善邮件、备选 MoR（Lemon Squeezy / Creem / Polar）、产品力与 SEO 建立信任。

## 10.5 数据与模型风险

- 后端初期可不做，但 **User / Order / License / Plan / Device / WebhookEvent 数据模型应在 P1 末期设计好**，避免后期大改。
- SQLite 起步需预留迁移 Postgres 的路径（SQLAlchemy 抽象，避免原生 SQL 写死方言）。
- **备份（关键）**：SQLite 文件在单台 VM 上，一旦 VM/磁盘故障即丢失订单与 License 数据。必须配置定期备份（每日导出 + 对象存储），并演练恢复。
- 金额用整数分存储，避免浮点误差。

## 10.6 运维风险

- GCP e2-micro 仅 1 GB 内存：后端须精简（uvicorn + SQLite，少依赖），监控内存与磁盘；注意 Always Free 区域限制（见 [09 §9.4](./09-deployment.md)）。
- 单 VM 单点：需备份 + 监控 + 快速重建镜像；备选 Cloud Run（但需换 Postgres，见 [09 §9.4](./09-deployment.md)）。
- 密钥轮换流程需事先定义（Paddle / JWT / Ed25519 私钥轮换不影响已签发 License）。

## 10.7 内容维护风险

- 本站文档原生维护，需确保与产品实际能力一致（避免描述滞后）；明确内容负责人与更新频率。
- 双语（en/zh）内容需同步更新，避免某一语言滞后；英文为 SEO 主线，中文滞后影响有限但体验差。

## 10.8 跨仓库协同风险

- P3/P4 的 License 激活需要 `video2text` 桌面端配合改造（读 Key、调用后端、验签），跨仓库协同排期易漏。
- 需明确两仓库的接口契约（License 载荷 schema、激活端点）、版本兼容策略与联调负责人。

## 10.9 依赖与供应链

- Astro / Tailwind / React / Paddle SDK 版本升级需锁定与回归测试（Dependabot/Renovate）。
- 第三方服务（Paddle、Cloudflare、GitHub）可用性需有降级方案（如 /changelog Release API 失败兜底、Webhook 重试与死信队列）。
