import { PUBLIC_GITHUB_API, PUBLIC_RELEASE_REPO } from "./env";

export interface DownloadAsset {
  url: string;
  platform: "windows";
  arch: "x64" | "arm64";
  kind: "installer" | "portable";
  name: string;
  size?: number;
}

export interface GitHubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  html_url: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

// 兜底版本：构建期无法访问 GitHub 时使用，保证页面可渲染。
export function fallbackVersion(): string {
  return "v0.1.0";
}

interface RawRelease {
  tag_name: string;
  name?: string;
  body?: string;
  html_url: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  assets?: GitHubAsset[];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// 资产命名约定（大小写不敏感）：
//   video2text-<ver>-x64-installer.exe / .msi
//   video2text-<ver>-x64-portable.exe
//   video2text-<ver>-arm64-installer.exe
//   video2text-<ver>-arm64-portable.exe
function parseAsset(
  name: string,
  browser_download_url: string,
  size?: number,
): DownloadAsset | null {
  const lower = name.toLowerCase();
  if (!lower.endsWith(".exe") && !lower.endsWith(".msi")) return null;

  const arch: "x64" | "arm64" | null = lower.includes("arm64")
    ? "arm64"
    : lower.includes("x64") || lower.includes("win64") || lower.includes("amd64")
      ? "x64"
      : null;
  if (!arch) return null;

  const kind: "installer" | "portable" | null = lower.includes("portable")
    ? "portable"
    : lower.includes("installer") || lower.includes("setup") || lower.endsWith(".msi")
      ? "installer"
      : null;
  if (!kind) return null;

  return { url: browser_download_url, platform: "windows", arch, kind, name, size };
}

export function parseDownloadAssets(release: { assets?: GitHubAsset[] }): DownloadAsset[] {
  if (!release.assets) return [];
  const assets: DownloadAsset[] = [];
  for (const a of release.assets) {
    if (!isNonEmptyString(a?.name) || !isNonEmptyString(a?.browser_download_url)) continue;
    const parsed = parseAsset(a.name, a.browser_download_url, a.size);
    if (parsed) assets.push(parsed);
  }
  return assets;
}

export async function fetchLatestRelease(
  repo: string = PUBLIC_RELEASE_REPO,
): Promise<RawRelease | null> {
  const data = await fetchJson<RawRelease>(`${PUBLIC_GITHUB_API}/repos/${repo}/releases/latest`);
  if (!data || !isNonEmptyString(data.tag_name)) return null;
  if (data.draft) return null;
  return data;
}

export async function fetchReleases(
  repo: string = PUBLIC_RELEASE_REPO,
  limit = 20,
): Promise<GitHubRelease[]> {
  const data = await fetchJson<RawRelease[]>(
    `${PUBLIC_GITHUB_API}/repos/${repo}/releases?per_page=${limit}`,
  );
  if (!Array.isArray(data)) return [];
  return data
    .filter((r) => r && !r.draft && isNonEmptyString(r.tag_name))
    .map((r) => ({
      tag_name: r.tag_name,
      name: r.name,
      body: r.body,
      html_url: r.html_url,
      published_at: r.published_at,
      prerelease: r.prerelease,
      assets: Array.isArray(r.assets) ? r.assets : [],
    }));
}
