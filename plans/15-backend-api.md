# 15 · 后端 API 接口文档

> 模块定位：对 `backend/`（FastAPI，P3）全部对外 HTTP 接口的权威说明，供前端联调、桌面端接入与测试参考。
> 配套：`plans/14-ops-runbook.md`（部署/调试）、`app/api/`、`app/schemas/`、`app/services/`。
> 当前代码状态：本地调试通过（`/health` 200，license 链路可跑）。本文档以实际代码为准。

---

## 15.1 基础约定

| 项               | 说明                                                                |
| ---------------- | ------------------------------------------------------------------- |
| 框架             | FastAPI（ASGI），工厂 `app.main:create_app`（`--factory`）          |
| 默认地址（本地） | `http://127.0.0.1:8000`                                             |
| 生产地址         | `https://api.video2text.dpdns.org`（Cloudflare 橙云 + Tunnel/源站） |
| 内容类型         | 请求/响应均为 `application/json`（webhook 除外，见 15.7）           |
| 时间格式         | ISO-8601 带 UTC（`...Z`）                                           |

### 认证（Bearer JWT）

用户会话使用 HS256 JWT，放在请求头：

```
Authorization: Bearer <access_token>
```

- 获取：POST `/auth/login` 返回 `access_token`。
- 有效期：由 `JWT_SECRET` + `ACCESS_TOKEN_TTL_MINUTES`（默认 7 天）决定。
- 校验失败统一返回 `401 unauthorized`（见 15.2）。

### 统一错误格式

所有错误（含全局异常）返回：

```json
{ "error": { "code": "<stable_code>", "message": "<human readable>" } }
```

HTTP 状态码见 15.8 错误码表。

### CORS

仅放行 `FRONTEND_ORIGINS` 白名单（逗号或 JSON 数组，按环境配置）。本机调试已含 `http://localhost:4321`、`http://127.0.0.1:4321`。允许方法：`GET, POST, OPTIONS`；允许头：`Authorization, Content-Type, Paddle-Signature`。

### 限流

仅 `/license/activate` 启用基于客户端 IP 的内存限流（单 worker 有效）：
`ACTIVATION_RATE_LIMIT_PER_IP`（默认 20）次 / 60 秒。超出返回 `429 rate_limited`。多 worker / 生产需改用 Redis/DB 计数。

---

## 15.2 接口总览

| 方法 | 路径                | 鉴权          | 说明                                    |
| ---- | ------------------- | ------------- | --------------------------------------- |
| GET  | `/health`           | 否            | 健康检查                                |
| POST | `/auth/register`    | 否            | 注册账号（201）                         |
| POST | `/auth/login`       | 否            | 登录获取 JWT                            |
| GET  | `/me`               | 是            | 获取当前用户                            |
| POST | `/license/activate` | 否（IP 限流） | 用 License Key 激活设备，签发离线 token |
| POST | `/license/verify`   | 否            | 校验 License 状态                       |
| POST | `/webhooks/paddle`  | 签名校验      | Paddle 支付事件接收（验签 + 幂等）      |
| GET  | `/video2text/stars` | 否            | 查询 GitHub 仓库 star 数（`app.video2text`） |
| GET  | `/video2text/stargazers` | 否      | 查询 star 本仓库的 GitHub 用户列表（login/id） |

> 新增的 `app.video2text` 模块见 `backend/app/video2text/`，访问 `GET /video2text/stars`（无需任何参数，固定查询 `fuyouling/video2text`；GitHub token 由服务端 `.env` 的 `GITHUB_TOKEN` 读取，不暴露在接口 URL 上，公开可访问）。

---

## 15.3 健康检查

### `GET /health`

探针 / 监控用，无副作用。

**响应 200**

```json
{ "status": "ok", "ts": "2026-08-11T21:20:09.783640+00:00" }
```

---

## 15.4 认证 Auth

### `POST /auth/register`

创建用户账号。

**请求体**

```json
{ "email": "user@example.com", "password": "supersecret" }
```

| 字段       | 类型   | 约束                   |
| ---------- | ------ | ---------------------- |
| `email`    | string | 合法邮箱（`EmailStr`） |
| `password` | string | 长度 8–128             |

**响应 201** — `UserOut`

```json
{ "id": 1, "email": "user@example.com", "created_at": "2026-08-11T21:00:00+00:00" }
```

**错误**

- `409 conflict` — 邮箱已存在：`An account with this email already exists`
- `422 validation_error` — 邮箱格式 / 密码长度不符

---

### `POST /auth/login`

校验凭据并返回会话令牌（OAuth2 密码流，`tokenUrl` 指向本接口）。

**请求体**

```json
{ "email": "user@example.com", "password": "supersecret" }
```

**响应 200** — `TokenOut`

```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```

**错误**

- `401 unauthorized` — 邮箱不存在 / 密码错误：`Invalid email or password`
- `422 validation_error` — 字段格式不符

> 调用方需在后续请求头带 `Authorization: Bearer <access_token>`。

---

### `GET /me`

返回当前登录用户（依赖 `Authorization` 头）。

**请求头**：`Authorization: Bearer <access_token>`

**响应 200** — `UserOut`

```json
{ "id": 1, "email": "user@example.com", "created_at": "2026-08-11T21:00:00+00:00" }
```

**错误**

- `401 unauthorized` — 缺令牌 / 令牌失效 / 用户不存在：`Invalid or expired token` / `User no longer exists`

---

## 15.5 License（桌面端核心）

所有 License Key 形如 `V2T-PRO-XXXX-XXXX-XXXX`（16 位大写，排除 `0/O/1/I`），服务器只存其 SHA-256 哈希，明文仅通过邮件一次性下发。

### `POST /license/activate`

用 Key 激活一台设备，返回**离线可验证**的签名 token（桌面端据此放行功能）。

**请求体** — `LicenseActivateRequest`

```json
{ "key": "V2T-PRO-ABCD-1234-EFGH", "machine_id_hash": "a1b2c3d4e5f6" }
```

| 字段              | 类型   | 约束                       |
| ----------------- | ------ | -------------------------- |
| `key`             | string | 长度 8–64                  |
| `machine_id_hash` | string | 长度 8–128（设备指纹哈希） |

**响应 200** — `LicenseActivateResponse`

```json
{
  "license_token": "<base64(payload).base64(ed25519_sig)>",
  "plan": "pro",
  "entitlements": ["batch", "incremental_plus", "priority_support"],
  "recheck_after": "2026-09-10T21:00:00+00:00"
}
```

- `license_token`：由 `LICENSE_ED25519_PRIVATE_KEY` 签名，桌面端用内置公钥验签。
- `recheck_after`：建议再次校验的时间（默认签发后 30 天）。
- `entitlements`：来自 `plans.features_json`。

**业务规则**

- 设备数达 `max_devices`（默认 2）时拒绝新设备：`409 conflict` `Device limit reached (2)...`
- Key 无效 / License 非 `active`：`404 not_found` `Invalid license key` / `License is <status>`。
- 已吊销设备再次激活会自动恢复（`revoked_at` 置空）。

**错误**

- `422 validation_error` — `machine_id_hash` 长度不足等
- `404 not_found` — Key 无效或状态异常
- `409 conflict` — 设备数超限
- `429 rate_limited` — IP 限流触发

---

### `POST /license/verify`

周期性校验 License 是否仍有效（桌面端离线到期前回调）。

**请求体** — `LicenseVerifyRequest`

```json
{ "license_id": "1", "machine_id_hash": "a1b2c3d4e5f6" }
```

| 字段              | 类型   | 约束                              |
| ----------------- | ------ | --------------------------------- |
| `license_id`      | string | 长度 1–64（对应 License 主键 id） |
| `machine_id_hash` | string | 长度 8–128                        |

**响应 200** — `LicenseVerifyResponse`

```json
{ "status": "active", "recheck_after": null }
```

`status` 取值：`active` | `refunded` | `revoked`（非 active 时直接返回该状态）。

**错误**

- `404 not_found` — License 不存在 / 无归属用户

---

## 15.6 Webhook（Paddle，MoR 支付）

### `POST /webhooks/paddle`

接收 Paddle 交易 / 退款事件，验签后落库并签发 / 吊销 License。

**请求头**：`Paddle-Signature: ts=<unix_ts>;h1=<hex_hmac>`

- 签名算法：HMAC-SHA256，对 `"<ts>:<raw_body>"` 用 `PADDLE_WEBHOOK_SECRET` 计算，与 `h1` 常量比较。
- 验签失败返回 `401 unauthorized` `Invalid webhook signature`（Paddle 按非 2xx 重试）。

**请求体**：Paddle 原始 JSON 信封（包含 `event_id` / `event_type` / `data`）。

**处理流程**（`app/services/payment_service.py`）

1. 验签 → 解析 JSON → 取 `event_id`（幂等键）。
2. 已处理过该 `event_id` → 直接返回 `{"status":"ok","duplicate":true}`（幂等）。
3. 首次：先 `record_event` 落库，再 `dispatch`：
   - `transaction.completed` → 按邮箱 upsert 用户 / 订单 → 签发 License（`V2T-PRO-...`）→ 发许可邮件（`mail_service`）。
   - `transaction.refunded` / `transaction.revoked` → 订单置 `refunded` → License 置 `refunded`/`revoked` → 发退款通知。
   - 其它类型 → 忽略并记录。

**响应 200**

```json
{ "status": "ok" }
```

（重复事件额外带 `"duplicate": true`）

**错误**

- `401 unauthorized` — 验签失败 / 缺 `event_id` / JSON 非法
- 处理中异常：记录日志并向上抛出（保证 Paddle 重试），不 leaking 内部细节。

> 本地 `MAIL_API_KEY` 为空时，`mail_service` 仅 `logger.warning` 不真正发信，可无网络跑通全流程。

---

## 15.7 数据模型（响应投影）

> 仅返回安全字段，绝不泄漏 `password_hash` / `key_hash` / `paddle_customer_id` 等内部值。

**UserOut**

| 字段         | 类型     |
| ------------ | -------- |
| `id`         | int      |
| `email`      | string   |
| `created_at` | datetime |

**LicenseActivateResponse**

| 字段            | 类型      | 说明                |
| --------------- | --------- | ------------------- |
| `license_token` | string    | 签名 token          |
| `plan`          | string    | 计划 id（如 `pro`） |
| `entitlements`  | list[str] | 权益列表            |
| `recheck_after` | datetime  | 建议复检时间        |

**LicenseVerifyResponse**

| 字段            | 类型                                    |
| --------------- | --------------------------------------- |
| `status`        | string（`active`/`refunded`/`revoked`） |
| `recheck_after` | datetime \| null                        |

**DeviceOut**：`id, machine_id_hash, first_seen_at, last_active_at, revoked_at?`
**LicenseOut**：`id, status, max_devices, created_at, devices[]`
**PlanOut**：`id, name, price_cents, currency, billing_type, max_devices`
**OrderOut**：`id, paddle_order_id, plan_id, amount_cents, currency, status, created_at`

---

## 15.8 错误码表

| HTTP | code               | 含义 / 触发                           |
| ---- | ------------------ | ------------------------------------- |
| 400  | `invalid_request`  | 通用参数错误（基类默认）              |
| 401  | `unauthorized`     | 缺/失效令牌、密码错、webhook 验签失败 |
| 403  | `forbidden`        | 权限不足                              |
| 404  | `not_found`        | License Key 无效、License/用户不存在  |
| 409  | `conflict`         | 邮箱已注册、设备数超限                |
| 422  | `validation_error` | Pydantic 请求体校验失败               |
| 429  | `rate_limited`     | IP 激活限流触发                       |
| 500  | `internal_error`   | 未捕获异常（生产不泄漏细节）          |

统一响应：`{ "error": { "code": "...", "message": "..." } }`

---

## 15.9 联调示例（curl）

```bash
# 1) 健康检查
curl -s http://127.0.0.1:8000/health

# 2) 注册
curl -s -X POST http://127.0.0.1:8000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"dev@example.com","password":"supersecret"}'

# 3) 登录拿 token
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"dev@example.com","password":"supersecret"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 4) 当前用户（带 Bearer）
curl -s http://127.0.0.1:8000/me -H "Authorization: Bearer $TOKEN"

# 5) 激活（machine_id_hash 需 >= 8 字符）
curl -s -X POST http://127.0.0.1:8000/license/activate \
  -H 'content-type: application/json' \
  -d '{"key":"V2T-PRO-TEST-0000-0000","machine_id_hash":"a1b2c3d4e5f6"}'

# 6) 校验
curl -s -X POST http://127.0.0.1:8000/license/verify \
  -H 'content-type: application/json' \
  -d '{"license_id":"1","machine_id_hash":"a1b2c3d4e5f6"}'

# 7) video2text 仓库 star 数（公开，无需 token / 参数）
curl -s "http://127.0.0.1:8000/video2text/stars"
```

> ⚠️ 示例中的 `V2T-PRO-TEST-0000-0000` 为占位 Key，本地无对应 License 记录时会返回 `404 not_found`；真实 Key 由 `transaction.completed` webhook 经 `security.generate_license_key()` 生成并邮件下发。

---

## 15.10 上线前核对（见 14.7）

- [ ] `/health` 返回 ok
- [ ] Paddle sandbox 发测试单 → webhook 验签成功 → License 签发 → 邮件收到 Key
- [ ] 同 `event_id` 重复投递仅处理一次（幂等）
- [ ] 退款 webhook → License 置 `refunded` → 桌面端复检失效
- [ ] 错误/缺签名 webhook 返回 401，不落库

---

## 15.11 本地测试：启动 / 关闭 / 重启（原生）

后端以系统 Python 直接运行（pip install --user 安装依赖，不使用 venv / conda），不依赖 Docker；生产以 systemd 单元运行（见 [14 §14.6.2](./14-ops-runbook.md)）。所有命令在 `backend/` 目录执行。

### 前置条件

- Python 3.11+（直接使用系统 Python，依赖装到用户目录，不使用 venv / conda）。
- `backend/.env` 存在且已填好必需密钥（`JWT_SECRET`、`LICENSE_ED25519_PRIVATE_KEY`、`PADDLE_*`、`MAIL_API_KEY`，以及 `GITHUB_TOKEN`）。`.env` 已被 `.gitignore` 排除，不会进仓库。
- 本机或可达的 MySQL 实例；`DB_URL` 指向其地址。应用启动时自动 `alembic upgrade head`（首次建表）。
- 监听 `127.0.0.1:8000`（仅本机回环，外网不可直连）。

### 安装依赖与迁移

```bash
cd backend
python3 -m pip install --user -r requirements.txt   # 直接使用系统 Python（pip --user），不使用 venv / conda
alembic upgrade head                            # 首次建表
```

### 启动（前台，看实时日志）

```bash
cd backend
uvicorn app.main:create_app --factory --reload --port 8000
# 日志出现 "Application startup complete" 即就绪；迁移失败则启动报错。
```

### 关闭 / 重启

- 前台运行时 Ctrl+C 即停。
- 改 `app/` 代码：`--reload` 自动热重载；改 `requirements.txt` 需重装依赖后重启。
- 改 `.env`：重启进程即重读（pydantic-settings 在启动时读 `./.env`）。

### 本机快速冒烟

```bash
curl -s http://127.0.0.1:8000/health
# => {"status":"ok","ts":"..."}
```

---

## 15.12 各接口访问方式（汇总）

> 除 `/health`、`/auth/*`、`/license/*`、`/webhooks/*` 外，其余接口落在全局 `enforce_auth` 之下，**必须带 `Authorization: Bearer <token>`**。例外：`GET /video2text/stars` 为公开接口（无需 token、无参数），GitHub token 仅在服务端 `.env` 读取，绝不出现在 URL 中。

统一取令牌（注册 + 登录）：

```bash
B=http://127.0.0.1:8000
curl -s -X POST $B/auth/register -H 'content-type: application/json' \
  -d '{"email":"dev@example.com","password":"supersecret"}' >/dev/null
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' \
  -d '{"email":"dev@example.com","password":"supersecret"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
```

| 方法 | 路径 | 鉴权 | 命令示例 |
| ---- | ---- | ---- | -------- |
| GET | `/health` | 否 | `curl -s $B/health` |
| POST | `/auth/register` | 否 | `curl -s -X POST $B/auth/register -H 'content-type: application/json' -d '{"email":"dev@example.com","password":"supersecret"}'` |
| POST | `/auth/login` | 否 | `curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"dev@example.com","password":"supersecret"}'` |
| GET | `/me` | 是 | `curl -s $B/me -H "Authorization: Bearer $TOKEN"` |
| POST | `/license/activate` | 否（IP 限流） | `curl -s -X POST $B/license/activate -H 'content-type: application/json' -d '{"key":"V2T-PRO-TEST-0000-0000","machine_id_hash":"a1b2c3d4e5f6"}'` |
| POST | `/license/verify` | 否 | `curl -s -X POST $B/license/verify -H 'content-type: application/json' -d '{"license_id":"1","machine_id_hash":"a1b2c3d4e5f6"}'` |
| POST | `/webhooks/paddle` | 签名校验 | 见 15.6（需 `Paddle-Signature` 头，非普通 curl） |
| GET | `/video2text/stars` | 否 | `curl -s "$B/video2text/stars"` |
| GET | `/video2text/stargazers` | 否 | `curl -s "$B/video2text/stargazers"` |

### `GET /video2text/stars` 说明

- 无查询参数：`owner`/`repo` 在代码中固定为 `fuyouling`/`video2text`（`app/video2text/routes.py` 的 `STARS_OWNER`/`STARS_REPO`）。
- 公开接口（无需 token、无需参数）；GitHub 访问令牌 `GITHUB_TOKEN` 仅从服务端 `.env` 读取，绝不以任何形式出现在接口 URL 或响应中。
- 实现：`app/video2text/client.py` 调 `GET /repos/{owner}/{repo}/stargazers?per_page=1`，解析响应 `Link` 头 `rel="last"` 的页码即为 star 总数；结果进程内缓存 5 分钟（`GITHUB_CACHE_TTL_SECONDS`）。
- 响应示例：

```json
{ "owner": "fuyouling", "repo": "video2text", "stars": 8 }
```

- 认证失败返回 `401 unauthorized`（同全局规则）。

### `GET /video2text/stargazers` 说明

- 无查询参数：`owner`/`repo` 固定为 `fuyouling`/`video2text`。
- 公开接口（无需 token、无需参数）；GitHub token 仅从服务端 `.env`（`GITHUB_TOKEN`）读取，不暴露在 URL 中。
- 实现：`app/video2text/client.py` 的 `get_stargazers()` 调 `GET /repos/{owner}/{repo}/stargazers` 并翻页（每页最多 100，`max_pages` 保护上限 100 页），逐页累加用户对象；结果进程内缓存 5 分钟（`GITHUB_CACHE_TTL_SECONDS`）。
- 响应字段 `stargazers[]` 仅投影安全字段：`login`（账户名）、`id`、`avatar_url`、`html_url`、`type`。
- 注意：翻页会消耗 GitHub API 额度（认证 5000/时），仅对展示场景调用，避免高频轮询。
- 响应示例：

```json
{
  "owner": "fuyouling",
  "repo": "video2text",
  "count": 8,
  "stargazers": [
    { "login": "fuyouling", "id": 32408484, "avatar_url": "https://avatars.githubusercontent.com/u/32408484?v=4", "html_url": "https://github.com/fuyouling", "type": "User" }
  ]
}
```

---

## 15.13 部署与更新程序（详细步骤）

> 架构与域名见 [09-deployment.md](./09-deployment.md) §9.3/§9.4：后端部署在 Oracle Cloud E2.1.Micro（或等价 VM），经 `api.video2text.dpdns.org` 由 Cloudflare 橙云 + Tunnel/反代暴露，CORS 白名单仅放行站点域名。

### 15.13.1 首次部署

1. **准备服务器**：Oracle Cloud `VM.Standard.E2.1.Micro`（1 OCPU / 1 GB，Always Free），Ubuntu 24.04；建议加 2GB swap（见 [14 §14.6.2](./14-ops-runbook.md) 阶段 2）。
2. **拉代码**：`git clone` 到服务器，例如 `/home/ubuntu/video2text-web`（含 `video2text-api.service` 与 `setup.sh`）。
3. **配置生产 `.env`**：在服务器写入 `backend/.env`（**切勿提交仓库**），至少包含：
   - `APP_ENV=production`
   - `FRONTEND_ORIGINS=["https://video2text.dpdns.org","https://www.video2text.dpdns.org"]`
   - `DB_URL=mysql+pymysql://video2text:Video2text%23@<mysql-host>:3306/video2text`（**独立 MySQL**；`#` 需 URL 编码为 `%23`）
   - `JWT_SECRET`、`LICENSE_ED25519_PRIVATE_KEY`
   - `PADDLE_API_KEY`、`PADDLE_WEBHOOK_SECRET`、`PADDLE_ENVIRONMENT`、`PADDLE_VENDOR_ID`
   - `MAIL_API_KEY`、`MAIL_FROM`
   - `GITHUB_TOKEN`（Personal access token，classic；可选，用于提高 GitHub API 限流）
   - 限流/安全相关：`ACTIVATION_RATE_LIMIT_PER_IP` 等
4. **安装并启动**（脚本用系统 Python 安装依赖（`pip install --user`）、安装 systemd 单元并启用；`ExecStartPre` 已配置 `alembic upgrade head` 自动迁移）：

   ```bash
   cd /home/ubuntu/video2text-web/backend
   sudo bash setup.sh
   ```

5. **反向代理 / TLS**：在 VM 上用 Caddy 反代 `127.0.0.1:8000` 并提供本地 TLS（见 [14 §14.6.2](./14-ops-runbook.md) 阶段 5）；Cloudflare DNS 为 `api` 加 CNAME，开启橙色云。
6. **冒烟验证**：

   ```bash
   curl -s https://api.video2text.dpdns.org/health
   # /video2text/stars 为公开接口，无需 token / 参数：
   curl -s "https://api.video2text.dpdns.org/video2text/stars"
   ```

7. **数据备份**：独立 MySQL 每日 `mysqldump` 导出 `video2text` 库并上传对象存储（见 [14 §14.6.2](./14-ops-runbook.md) 阶段 7）；schema 由 `alembic` 管理。

### 15.13.2 更新程序（代码/依赖变更后）

```bash
cd /home/ubuntu/video2text-web && git pull          # 或重新上传 backend/ 目录
cd backend && sudo bash setup.sh            # 重装依赖并重启服务（setup.sh 幂等）
sudo journalctl -u video2text-api --tail 20 # 确认 "Application startup complete"
```

- 仅改 `.env`：`sudo systemctl restart video2text-api`（无需重装）。
- 仅改 `requirements.txt` 或 `app/` 代码：`setup.sh` 重装依赖并重启即生效。
- 迁移新增/变更：service 的 `ExecStartPre` 已含 `alembic upgrade head`，重启即自动应用；如需手动：`sudo -u ubuntu /home/ubuntu/.local/bin/alembic upgrade head`。

### 15.13.3 回滚

- **代码回滚**：`git checkout <prev>` 后 `sudo systemctl restart video2text-api`；无需构建镜像。
- **数据库回滚**：Alembic 迁移若不可逆，先用 `mysqldump` 备份恢复再降级代码；重大 schema 变更前务必先 `mysqldump` 备份。
- 回滚后同样跑 15.13.1.6 冒烟。

### 15.13.4 运维要点

- systemd 单元 `MemoryMax=512M`，1GB 小机下避免多 worker；`uvicorn` 单 factory 实例。
- 限流为单 worker 内存计数；多实例需换 Redis/DB。
- 密钥仅在部署环境（`.env`，权限 600），永不进仓库（见 9.4）。

