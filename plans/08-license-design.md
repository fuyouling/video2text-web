# 08 · License 设计提案

> 模块定位：定义 Pro 买断制的 License 形态、激活/退款策略与数据模型。前端不接触密钥逻辑。
> 上级索引：[00-overview.md](./00-overview.md)

Pro 为 **$9.9 一次性买断**，License 为密钥（如 `V2T-PRO-XXXX-XXXX-XXXX`），签发与撤销仅在后端完成（前端不接触密钥逻辑）。

## 8.1 密钥与许可载荷

- **Key 格式**：`V2T-PRO-XXXX-XXXX-XXXX`（分组大写字母数字，排除易混字符 `0/O/1/I`，便于人工抄写与客服核对）。
- **生成**：后端使用密码学安全随机源生成；**入库仅存哈希**（SHA-256/HMAC），明文只在签发时一次性交付（邮件 + 成功页）。
- **许可载荷（License File / Token）**：激活成功后由后端下发 **Ed25519 签名**的载荷，桌面端用内置**公钥离线验签**：

```json
{
  "license_id": "...",
  "plan": "pro",
  "machine_id": "<hashed>",
  "issued_at": "2026-08-11T00:00:00Z",
  "expires_at": null,                 // 买断制无到期
  "recheck_after": "2026-09-10T00:00:00Z",  // 建议下次联网复核时间
  "entitlements": ["batch", "incremental_plus", "priority_support"]
}
```

- 私钥仅存后端环境变量/密钥管理，**绝不进仓库或客户端**；公钥内置于桌面端。
- 这样设计可实现：**联网一次激活，之后长期离线可用**（契合"本地离线"定位）。

## 8.2 激活策略

- **设备上限**：默认 **2 台设备**（个人常用 + 备用），满足单用户多机使用。
- **机器指纹 `machine_id`**：
  - 由桌面端本地采集稳定标识（如机器 GUID / 主板或磁盘序列的派生值），**先本地哈希**后再上报，服务端只存哈希，符合隐私定位；
  - 需容忍系统重装/硬件小幅变更导致指纹变化 → 靠"自助换机"兜底，不做严格硬绑定。
- **自助换机**：用户在 `/account` 自助「注销设备」释放名额后，可在新设备重新激活；不限制总换机次数。
- **风控**：
  - 激活接口限流（按 IP / License Key；生产多 worker 需分布式限流，见 [13 §13.9](./13-code-design-detail.md)）；
  - 「短时高频换机」触发人工复核（如 24h 内 >5 次）；
  - 同一 Key 出现大量不同指纹时，标记异常并可临时冻结（需有申诉通道，避免误伤）。
- **离线宽限（重要）**：周期复核失败（无网络、服务不可达）**不得**立即锁定功能，应给 **≥14 天宽限期**；超期且仍无法联网时，降级为 Free 而非阻断使用，且提示原因。
- **激活流程**：
  1. 桌面端输入 License Key
  2. 后端校验 Key 哈希、状态、设备数
  3. 返回 Ed25519 签名许可（绑定 `machine_id` 哈希）
  4. 本地缓存许可文件，离线可用；到 `recheck_after` 后尝试联网复核状态

## 8.3 退款策略

- 由 **Paddle 处理退款**（Paddle 作为 MoR 负责退款与开票）。
- 建议 **14 天无理由退款**；条款写入 `/refund` 页面（Paddle 入驻常见要求）。
- 退款后后端将对应 License 置为 `refunded/revoked`，桌面端下次联网复核时失效（受 §8.2 宽限期影响，撤销生效存在延迟，属可接受损失）。
- 需保留人工申诉与重新签发通道（邮箱找回 Key）。

## 8.4 数据模型（后端 ORM，P1 末期即设计）

```text
User        (id, email[unique], paddle_customer_id, created_at)
Order       (id, user_id, paddle_order_id[unique], plan_id, amount_cents, currency, status, created_at)
License     (id, user_id, order_id, key_hash, status[active|revoked|refunded],
             max_devices, created_at, revoked_at)
Device      (id, license_id, machine_id_hash, first_seen_at, last_active_at, revoked_at)
Plan        (id, name, price_cents, currency, billing_type[one-time], features_json)
WebhookEvent(id, provider, event_id[unique], type, payload_json, processed_at)
```

- 活跃设备数由 `Device`（`revoked_at IS NULL`）实时统计，不冗余存 `activated_devices`。
- 金额用整数分存储，避免浮点误差。

## 8.5 License 状态机

```
issued ──激活──▶ active ──退款/撤销──▶ refunded / revoked
                   │
                   └──设备注销──▶ active（名额释放，状态不变）
```

- 允许状态：`active` → `revoked`/`refunded`（不可逆，除人工恢复）。
- 所有状态变更写审计日志（谁、何时、因何事件）。

## 8.6 校验时序（桌面端 ↔ 后端 ↔ Paddle）

```
桌面端                后端                    Paddle
  │── License Key ───▶│
  │                   │ 校验 key_hash/状态/设备数
  │◀─ 签名许可(Ed25519)│ (绑定 machine_id 哈希)
  │   本地缓存          │
  │   离线可用(公钥验签) │
  │── 周期复核 ───────▶│
  │◀── status ────────│ (active/revoked)
  │   失败→14天宽限期   │
  │                   │◀── Webhook(退款/撤销) ──│
  │                   │ License→refunded/revoked
```

## 8.7 开源与授权可绕过（必须正视）

- 若 `video2text` 桌面端**开源**，任何纯客户端的 Pro 开关都可被移除重编译，License 无法从技术上强制。
- 可选应对策略（需在 [11 §11.2](./11-tbd.md) 决策）：
  1. **诚信付费（推荐，成本最低）**：Pro 权益仍走客户端解锁，但定位为"支持开发者"，接受一定比例绕过；官方发行版走签名安装包，绕过者需自行编译。
  2. **服务端兑现**：把部分 Pro 权益放到只能由服务端提供的能力上（如云端签发的批处理配置、License 绑定的下载通道），但会削弱"纯本地"卖点，需谨慎。
  3. **闭源 Pro 模块**：核心免费功能开源，Pro 功能以闭源插件/二进制形式分发（许可证需与主仓库许可证兼容）。
- **不要**在官网承诺技术上无法兑现的独占性（如"Pro 独享算法"），避免退款争议。

## 8.8 待确认（关联 [11-tbd.md](./11-tbd.md)）

- Paddle 商户入驻材料与周期，以及中国大陆卖家可行性（含备选 MoR）。
- 退款窗口与是否设"激活次数上限"作为退款条件（建议不设硬阈值，避免争议）。
- `machine_id` 具体取法与稳定性（跨重装/硬件变更）需技术验证。
- Pro 权益清单最终版（须为无持续云成本项，见 [02 §2.3](./02-product-positioning.md)）。
- 开源策略与 Pro 强制力的取舍（§8.7）。
