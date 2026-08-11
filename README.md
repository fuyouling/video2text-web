# video2text-web

Official website for **video2text** — local, private audio & video transcription and summarization.

> This is the marketing/docs website (built with Astro, static output). It is **not** an online transcription service.

## Tech stack

- [Astro](https://astro.build) 5 (static output)
- React 18 (islands)
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- MDX content
- i18n: English (`/en`) + 简体中文 (`/zh`); `/` redirects to `/en`
- Deploy: Cloudflare Pages

## Prerequisites

Developed and built on **WSL / Ubuntu 26.04 LTS**. Required toolchain:

| Tool | Version | Purpose | Status on this machine |
| --- | --- | --- | --- |
| Node.js | `>=24` (pinned `24.14.0` in `.nvmrc`) | Astro dev/build | ❌ Not installed (only a Windows `node.exe` exists, which cannot run on Linux) |
| npm | `>=10` (ships with Node) | Install dependencies | ❌ Not installed |
| Python 3 | `>=3.10` | Icon/image generation (`npm run icons`) | ✅ 3.14.4 |
| Pillow | latest | `scripts/generate_icon.py` dependency | ❌ Not installed (pip also missing) |
| Git | recent | Repository | ✅ 2.53.0 |

> ⚠️ The Windows Node install at `/mnt/c/dev/nodejs/` (`node.exe` v24.14.0) **cannot run inside WSL/Linux**. Install Node natively in the Linux environment (see below).

## Quick start (WSL / Ubuntu)

```bash
# 1. Install Node 24 (via nvm — recommended, matches .nvmrc)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 24.14.0
nvm use 24.14.0

# 2. Python deps for icon generation
sudo apt update && sudo apt install -y python3-pip
python3 -m pip install --user Pillow

# 3. Install project deps & create local env
npm ci
cp .env.example .env        # only PUBLIC_* public vars; no secrets

# 4. Generate static assets, then check / build / run
python3 scripts/generate_icon.py
npm run check               # astro check + tsc --noEmit
npm run build               # output to ./dist
npm run dev                 # http://localhost:4321  (/ -> /en, /zh)
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Astro dev server |
| `npm run build` | Static production build → `./dist` |
| `npm run preview` | Preview the built `dist` locally |
| `npm run check` | `astro check` + `tsc --noEmit` |
| `npm run lint` | ESLint + Prettier check |
| `npm run fmt` | Prettier write |
| `npm run icons` | Regenerate favicon/OG/Logo from `scripts/generate_icon.py` |

## Configuration

Copy `.env.example` to `.env`. All variables are public (`PUBLIC_*`):

- `PUBLIC_SITE` — site origin (also drives Astro `site`)
- `PUBLIC_API_BASE` — backend API base URL (P3)
- `PUBLIC_RELEASE_REPO` — repo used for /changelog release notes (and the download CTA target)
- `PUBLIC_GITHUB_API` — GitHub API base

## Documentation

Detailed architecture, ops, and runbook live under [`plans/`](./plans), especially [`plans/14-ops-runbook.md`](./plans/14-ops-runbook.md).
