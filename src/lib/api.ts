// 前端 ↔ 后端 API 客户端（统一基址 + 统一错误解析）。
// 基址来自 PUBLIC_API_BASE（本地开发为 http://127.0.0.1:8000，生产为 api.video2text.dpdns.org）。
// 所有响应错误统一为 { error: { code, message } }，见后端 errors.py。

import { PUBLIC_API_BASE } from './env';

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PUBLIC_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiClientError(
      err?.code ?? 'unknown',
      err?.message ?? res.statusText,
      res.status,
    );
  }
  return data as T;
}

// --------------------------------------------------------------------------- //
// Types (mirrors backend schemas in app/schemas)
// --------------------------------------------------------------------------- //
export interface Health {
  status: string;
  ts: string;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
}

export interface UserOut {
  id: number;
  email: string;
  created_at: string;
}

export interface LicenseActivateResponse {
  license_token: string;
  plan: string;
  entitlements: string[];
  recheck_after: string;
}

export interface LicenseVerifyResponse {
  status: string;
  recheck_after: string | null;
}

// --------------------------------------------------------------------------- //
// Endpoints
// --------------------------------------------------------------------------- //
export function getHealth(): Promise<Health> {
  return request<Health>('/health');
}

export function register(body: { email: string; password: string }): Promise<UserOut> {
  return request<UserOut>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function login(body: { email: string; password: string }): Promise<TokenOut> {
  return request<TokenOut>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getMe(token: string): Promise<UserOut> {
  return request<UserOut>('/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function activateLicense(body: {
  key: string;
  machine_id_hash: string;
}): Promise<LicenseActivateResponse> {
  return request<LicenseActivateResponse>('/license/activate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function verifyLicense(body: {
  license_id: string;
  machine_id_hash: string;
}): Promise<LicenseVerifyResponse> {
  return request<LicenseVerifyResponse>('/license/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
