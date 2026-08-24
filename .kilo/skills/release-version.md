---
name: release-version
description: Automate releasing a new version of this repo to GitHub. Use when the user wants to "release a new version", "publish a version", "打 tag 发布", "提交并打 tag", or bump the version (e.g. v3.8 -> v3.9) and push it. Stages all changes, commits with "Release vX.Y", creates an annotated/lightweight tag vX.Y, and pushes commits + tags to origin/main. Honors the existing convention where each tag triggers the build.yml deploy workflow.
---

# Release a New Version

Automate the repeatable "commit code + tag a version + push to GitHub" workflow used in this repo.

## Steps

1. **Check the working tree.** Run `git status --short`.
   - If the output is empty, there is nothing to commit. Tell the user "没有需要提交的改动" and STOP — do not create an empty commit or tag.
   - Otherwise, proceed.

2. **Determine the version.**
   - If the user explicitly gave a version (e.g. `v3.9` or `3.9`), use it. Normalize so it starts with `v` (e.g. `3.9` -> `v3.9`).
   - If no version was given, auto-compute the next version:
     - Get the latest tag: `git describe --tags --abbrev=0`
     - Strip the leading `v`, split on `.`, increment the LAST numeric component, rejoin, and prepend `v`.
       - Example: latest `v3.8` -> next `v3.9`.
   - Sanity check: confirm the computed/new tag does NOT already exist (`git tag --list "vX.Y"` should be empty). If it exists, ask the user for the correct version instead of overwriting.

3. **Verify the branch and remote.**
   - Ensure you are on `main` (or the intended release branch). If not, warn the user.
   - Confirm `origin` points to the expected repo (`git remote -v`).

4. **Commit, tag, and push.**
   - `git add -A`
   - `git commit -m "Release <VERSION>"`   (VERSION including the `v`, e.g. `Release v3.9`)
   - `git tag <VERSION>`
   - `git push origin <branch> --tags`   (branch is usually `main`)

5. **Report the result concisely**: the new commit hash, the tag created, and that it was pushed. Mention that tagging `v*` triggers the `build.yml` deploy workflow (expected behavior — maintain the current setup).

## Notes / Convention
- This repo tags every release (v2.1 … v3.8 …) and `build.yml` deploys on `on: push: tags: v*`. Keep that behavior; do NOT change the workflow triggers.
- Do not create releases on GitHub UI unless the user asks — tagging + pushing is sufficient here.
- Never force-push and never delete tags as part of a normal release.
