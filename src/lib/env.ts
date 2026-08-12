// 集中读取构建期/运行时公开环境变量（仅 PUBLIC_*，不含任何密钥）。
// 同时提供安全的默认值，保证在无 .env 的情况下也能完成构建/类型检查。

const env = import.meta.env;

export const PUBLIC_SITE: string = env.PUBLIC_SITE || "https://video2text.dpdns.org";

export const PUBLIC_API_BASE: string = env.PUBLIC_API_BASE || "https://api.video2text.dpdns.org";

export const PUBLIC_RELEASE_REPO: string = env.PUBLIC_RELEASE_REPO || "fuyouling/video2text";

export const PUBLIC_GITHUB_API: string = env.PUBLIC_GITHUB_API || "https://api.github.com";
