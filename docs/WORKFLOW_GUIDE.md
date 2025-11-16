# GitHub Actions Workflow Guide

## 🔒 Privacy & Security Guarantee

### Does Google collect any data?

**NO. Absolutely not.**

- ✅ **release-please is 100% open source**: https://github.com/googleapis/release-please
- ✅ **Runs on GitHub's infrastructure** (Microsoft/GitHub servers, NOT Google)
- ✅ **No data sent to Google** - it's just a tool they maintain
- ✅ **Fully auditable code** - you can inspect every line
- ✅ **No telemetry, no tracking, no external connections**

**It's like:**
- Angular (maintained by Google, runs locally)
- Kubernetes (maintained by Google, runs locally)
- TensorFlow (maintained by Google, runs locally)

**Technical proof:**
```bash
# Inspect the action code yourself
git clone https://github.com/googleapis/release-please
cd release-please
# All code is visible - no hidden telemetry
```

The action only:
1. Reads your git commits (locally on GitHub runners)
2. Parses conventional commit messages
3. Creates/updates a PR on YOUR GitHub repository
4. Creates GitHub Releases when PR is merged

**Everything stays on GitHub. Nothing goes to Google.**

---

## 🚀 How the Workflow Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Developer makes commits with conventional commit format   │
│  Example: "feat: add feature" or "fix: resolve bug"       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ git push origin master
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  1. release-please.yml (Automated Release Management)      │
│     - Analyzes commits since last release                  │
│     - Calculates next version (semantic versioning)        │
│     - Creates/updates Release PR with:                     │
│       • Updated CHANGELOG.md                               │
│       • Version bump in package.json                       │
│       • Tag creation plan                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Review & Merge PR
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Release Created (by release-please)                     │
│     - Creates GitHub Release with tag (e.g., v1.5.0)       │
│     - Includes changelog in release notes                  │
│     - Triggers build.yml workflow automatically            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ on: release: [published]
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  3. build.yml (Build & Upload Artifacts)                   │
│     - Extracts version from release tag                    │
│     - Builds on 4 platforms in parallel:                   │
│       • Windows (x64)                                       │
│       • macOS Intel (x64)                                   │
│       • macOS Apple Silicon (arm64)                         │
│       • Linux (x64)                                         │
│     - Creates installers (exe, dmg, AppImage, etc.)        │
│     - Uploads artifacts to the release                     │
│     - Generates version.json for auto-updater              │
│     - Deploys to GitHub Pages                              │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
         Release is Complete! 🎉
```

---

## 📋 Workflow Files

### 1. `.github/workflows/release-please.yml`

**Purpose:** Automated release management

**Triggers:**
- `push` to `master` branch

**What it does:**
1. Analyzes commits since last release
2. Determines version bump (major, minor, patch)
3. Creates/updates a Release PR with:
   - Updated `CHANGELOG.md`
   - Version bump in `package.json` and `package-lock.json`
   - Planned tag name

**Outputs:**
- `release_created`: true if a release was just created
- `tag_name`: The release tag (e.g., v1.5.0)
- `version`: The version number (e.g., 1.5.0)

**When does it create a release?**
- Only when you **merge the Release PR** it created
- NOT on every commit - only after PR merge

---

### 2. `.github/workflows/build.yml`

**Purpose:** Build and publish release artifacts

**Triggers:**
- `release: types: [published]` (automatic from release-please)
- `workflow_dispatch` (manual trigger - fallback)

**Jobs:**

#### Job 1: `prepare`
- Determines version from release tag or manual input
- Outputs version for other jobs to use

#### Job 2: `build`
- Runs on 4 platforms in parallel:
  - Windows (latest)
  - macOS Intel (macos-13)
  - macOS ARM64 (macos-14)
  - Linux (ubuntu-latest)
- Installs dependencies with `npm ci`
- Runs security audit
- Builds application with `npm run build`
- Packages for platform:
  - **Windows:** NSIS installer (.exe) + ZIP
  - **macOS Intel:** DMG + ZIP
  - **macOS ARM64:** DMG + ZIP
  - **Linux:** AppImage + tar.gz
- Uploads artifacts (retained for 1 day)

#### Job 3: `release`
- Downloads all artifacts from build job
- **If triggered by release-please:**
  - Uploads artifacts to existing release
- **If triggered manually:**
  - Creates new draft release with artifacts
- Extracts changelog from CHANGELOG.md
- Generates `version.json` for auto-updater:
  ```json
  {
    "version": "1.5.0",
    "buildDate": "2025-01-13T10:00:00Z",
    "commitHash": "abc1234",
    "releaseUrl": "https://github.com/.../releases/tag/v1.5.0",
    "downloadLinks": {
      "windows": { "installer": "...", "portable": "..." },
      "macos": { "intel": {...}, "arm64": {...} },
      "linux": { "appimage": "...", "tarball": "..." }
    }
  }
  ```
- Generates `changelog.json` for updater window
- Deploys to GitHub Pages branch

---

## 🎯 Usage Examples

### Normal Development Flow (Recommended)

```bash
# 1. Make changes and commit with conventional format
git add .
git commit -m "feat: add new data export format"
git commit -m "fix: resolve CSV encoding issue"
git push origin master

# 2. Wait for release-please to create/update Release PR
#    - Check GitHub "Pull Requests" tab
#    - PR title: "chore(master): release 1.5.0"

# 3. Review the Release PR
#    - Check updated CHANGELOG.md
#    - Verify version bump is correct
#    - Review all changes included

# 4. Merge the Release PR
#    - Click "Merge pull request"
#    - Release is automatically created

# 5. Wait for build workflow to complete (~20 minutes)
#    - Artifacts are uploaded to release
#    - GitHub Pages is updated
#    - Users can now auto-update!
```

### Manual Build (Fallback)

If you need to manually trigger a build:

```bash
# Go to GitHub Actions tab
# Select "Build and Release" workflow
# Click "Run workflow"
# Enter version: 1.5.0
# Click "Run workflow"
```

This will:
- Build all platforms
- Create a **draft release** (not published)
- Upload artifacts
- Update GitHub Pages

---

## 🔄 Version Bumping Rules

release-please automatically determines version bumps based on commits:

| Commit Type | Example | Version Bump |
|------------|---------|--------------|
| `fix:` | `fix: resolve crash` | Patch (1.0.x) |
| `feat:` | `feat: add new feature` | Minor (1.x.0) |
| `BREAKING CHANGE:` | See below | Major (x.0.0) |
| `perf:` | `perf: optimize render` | Patch (1.0.x) |
| `docs:` | `docs: update README` | Patch (1.0.x) |
| `chore:`, `style:`, etc. | Various | Patch (1.0.x) |

**Breaking Change Example:**
```bash
git commit -m "feat: redesign API

BREAKING CHANGE: Old API endpoints removed"
# This triggers 1.x.x → 2.0.0
```

---

## 📊 Workflow Comparison

### Before (manual with standard-version)

```bash
# 1. Run npm command locally
npm run release:patch

# 2. Push tags manually
git push --follow-tags

# 3. Wait for build (if automated)

# 4. Manually create GitHub Release
#    - Go to GitHub website
#    - Create release
#    - Upload artifacts manually
#    - Write release notes manually

# 5. Manually update version.json

# 6. Manually deploy to GitHub Pages
```

**Problems:**
- 😓 Multiple manual steps
- 🐛 Easy to forget steps
- ⏰ Time-consuming
- 🔧 Requires local environment
- ❌ Human error prone

### After (automated with release-please)

```bash
# 1. Push commits
git push origin master

# 2. Merge Release PR (when ready)

# Done! ✅
# - Release created automatically
# - All platforms built automatically
# - Artifacts uploaded automatically
# - GitHub Pages updated automatically
```

**Benefits:**
- ✅ Single click (merge PR)
- ✅ Fully automated
- ✅ No local environment needed
- ✅ Consistent process
- ✅ PR-based (reviewable)
- ✅ CI/CD best practices

---

## 🛠️ Troubleshooting

### Release PR not created

**Problem:** Pushed commits but no Release PR appears

**Solutions:**
1. Check GitHub Actions tab for errors
2. Verify commits use conventional format:
   ```bash
   git log --oneline -5
   # Should show: feat:, fix:, etc.
   ```
3. Check repository settings:
   - Settings > Actions > General
   - "Workflow permissions" = "Read and write permissions"

### Build workflow not triggered

**Problem:** Merged Release PR but build didn't start

**Solutions:**
1. Check if release was actually published:
   - Go to Releases tab
   - Should see new release (not draft)
2. Manually trigger build:
   - Actions > Build and Release
   - Run workflow > Enter version

### Artifacts not uploaded

**Problem:** Build completed but no files in release

**Solutions:**
1. Check build logs for errors
2. Verify artifact upload step succeeded
3. Check file permissions in repository settings

### version.json not updated

**Problem:** Auto-updater not finding new version

**Solutions:**
1. Check GitHub Pages deployment:
   - Settings > Pages
   - Should be enabled on `gh-pages` branch
2. Verify deploy step in build workflow succeeded
3. Check `gh-pages` branch for updated files
4. Clear browser cache: https://browse4extract.github.io/browse4extract/version.json

---

## 🔐 Security Notes

### Token Permissions

The workflows use `GITHUB_TOKEN` with minimal permissions:

**release-please.yml:**
- `contents: write` - Create tags, releases
- `pull-requests: write` - Create/update Release PRs

**build.yml:**
- `contents: write` - Upload artifacts to releases

These are **temporary tokens** that:
- Expire after workflow completes
- Only work within the repository
- Cannot access other repositories
- Are automatically provided by GitHub

### Artifact Retention

Build artifacts are stored temporarily:
- **Retention:** 1 day
- **Purpose:** Transfer between jobs
- **Release artifacts:** Permanently attached to release

### Code Signing

If you need code signing (recommended for production):

1. **Windows:** Add signing certificate to repository secrets
2. **macOS:** Add Apple Developer ID to secrets
3. Update `electron-builder` configuration

---

## 📈 Monitoring

### Check Workflow Status

```bash
# Via GitHub website
https://github.com/browse4extract/browse4extract/actions

# Via GitHub CLI
gh run list --workflow=release-please.yml
gh run list --workflow=build.yml

# View specific run
gh run view <run-id> --log
```

### Release Metrics

Track releases:
- https://github.com/browse4extract/browse4extract/releases
- RSS feed: `/releases.atom`
- API: `https://api.github.com/repos/browse4extract/browse4extract/releases/latest`

---

## 🎓 Learning Resources

- **Conventional Commits:** https://www.conventionalcommits.org/
- **release-please docs:** https://github.com/googleapis/release-please
- **GitHub Actions:** https://docs.github.com/en/actions
- **Semantic Versioning:** https://semver.org/

---

## ✅ Summary

**Two workflows working together:**

1. **release-please.yml** - Creates releases based on commits
2. **build.yml** - Builds artifacts when release is published

**Zero manual steps:**
- Push commits → Release PR created → Merge PR → Release published → Artifacts built → Pages updated

**Everything is automated, reviewable, and auditable.**

**Google collects nothing. All data stays on GitHub. 🔒**
