/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE: string;
  readonly PUBLIC_API_BASE: string;
  readonly PUBLIC_RELEASE_REPO: string;
  readonly PUBLIC_GITHUB_API: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
