export interface PlatformInfo {
  os: 'windows' | 'macos' | 'linux' | 'unknown';
  arch: 'x64' | 'arm64' | 'unknown';
}

export function detectPlatform(): PlatformInfo {
  if (typeof navigator === 'undefined') return { os: 'unknown', arch: 'unknown' };

  // 优先使用高熵 UA 客户端提示（已取代废弃的 navigator.platform）
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string; getHighEntropyValues?: (keys: string[]) => Promise<{ architecture?: string }> } }).userAgentData;
  const ua = navigator.userAgent;

  let os: PlatformInfo['os'] = 'unknown';
  const platformHint = uaData?.platform?.toLowerCase() ?? '';
  const uaLower = ua.toLowerCase();

  if (platformHint.includes('win') || uaLower.includes('windows')) os = 'windows';
  else if (platformHint.includes('mac') || uaLower.includes('mac os') || uaLower.includes('macintosh')) os = 'macos';
  else if (platformHint.includes('linux') || uaLower.includes('linux') || uaLower.includes('x11')) os = 'linux';

  let arch: PlatformInfo['arch'] = 'unknown';
  if (uaLower.includes('arm64') || uaLower.includes('aarch64') || platformHint.includes('arm')) {
    arch = 'arm64';
  } else if (uaLower.includes('x86_64') || uaLower.includes('win64') || uaLower.includes('x64') || uaLower.includes('wow64')) {
    arch = 'x64';
  } else if (uaLower.includes('x86') || uaLower.includes('i686') || uaLower.includes('i386')) {
    arch = 'x64';
  }

  // 仅在支持时异步补充架构信息
  if (uaData?.getHighEntropyValues) {
    uaData
      .getHighEntropyValues(['architecture'])
      .then((v) => {
        if (v.architecture === 'arm') arch = 'arm64';
        else if (v.architecture === 'x86') arch = 'x64';
      })
      .catch(() => {});
  }

  return { os, arch };
}

export interface PickAsset {
  platform: 'windows';
  arch: 'x64' | 'arm64';
  kind: 'installer' | 'portable';
  url: string;
}

export function pickAsset(assets: PickAsset[], info: PlatformInfo): PickAsset | null {
  if (info.os !== 'windows') return null;
  const arch = info.arch === 'arm64' ? 'arm64' : 'x64';
  return assets.find((a) => a.arch === arch && a.kind === 'installer') ?? assets.find((a) => a.arch === arch) ?? assets[0] ?? null;
}

export async function refreshLatestVersion(repo: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string };
    return data.tag_name ?? null;
  } catch {
    return null;
  }
}
