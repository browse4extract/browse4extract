# Building for Windows

Complete guide for building Browse4Extract on Windows, including troubleshooting common issues.

## Prerequisites

### Required Software

1. **Node.js 18+**
   - Download: https://nodejs.org/
   - Verify: `node --version` (should be v18.0.0 or higher)

2. **npm** (comes with Node.js)
   - Verify: `npm --version` (should be 9.0.0 or higher)

3. **Git**
   - Download: https://git-scm.com/
   - Verify: `git --version`

4. **Python 3.x** (for native modules)
   - Download: https://www.python.org/
   - Verify: `python --version`
   - **Note:** Required by some npm packages (node-gyp)

5. **Visual Studio Build Tools** (optional but recommended)
   - Download: https://visualstudio.microsoft.com/downloads/
   - Select "Desktop development with C++"
   - **Why:** Required for compiling native Node.js modules

### Recommended Software

- **Windows Terminal** - Better terminal experience
- **VS Code** - Recommended IDE with TypeScript support
- **Git Bash** - Alternative to PowerShell

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/browse4extract/browse4extract.git
cd browse4extract
```

### 2. Install Dependencies

```bash
npm install
```

**Expected time:** 2-5 minutes depending on internet speed.

**Common errors:**
- `EACCES` permission errors → Run terminal as Administrator
- `node-gyp` errors → Install Visual Studio Build Tools
- `ENOENT` errors → Check Node.js and Python are in PATH

### 3. Build Application

```bash
npm run build
```

**Output:** Compiled files in `dist/` folder

**Build steps:**
1. Compiles TypeScript → JavaScript
2. Bundles main process with Webpack
3. Bundles renderer process with Webpack
4. Processes Tailwind CSS
5. Copies assets

**Expected time:** 20-40 seconds

### 4. Test Build

```bash
npm run start
```

**What it does:** Runs Electron with the compiled `dist/` folder

**Expected result:** Application opens successfully

---

## Packaging for Distribution

### Development Build (Faster)

```bash
npm run package:dev
```

**What it does:**
- Builds the app (production mode)
- Packages with electron-builder
- Creates unpacked Windows folder only
- Skips installer creation
- **No code signing**

**Output:** `out/win-unpacked/Browse4Extract.exe`

**Use case:** Testing packaged app before creating installer

**Expected time:** 1-2 minutes

---

### Production Build (Full)

```bash
npm run package
```

**What it does:**
- Builds the app (production mode)
- Packages with electron-builder
- Creates unpacked Windows folder
- Creates NSIS installer (`Browse4Extract-Setup.exe`)
- Creates portable ZIP archive
- **No code signing** (CSC_IDENTITY_AUTO_DISCOVERY=false)

**Output:**
- `out/win-unpacked/Browse4Extract.exe` - Unpacked app
- `out/Browse4Extract Setup 1.1.1.exe` - Installer
- `out/Browse4Extract-1.1.1-win.zip` - Portable ZIP

**Expected time:** 2-4 minutes

---

## Troubleshooting

### Issue 1: rcedit Error - "Unable to commit changes"

**Symptom:**
```
⨯ cannot execute  cause=exit status 1
errorOut=Fatal error: Unable to commit changes

command='C:\Users\...\rcedit-x64.exe' '...\Browse4Extract.exe' ...
```

**Cause:** Windows Defender or antivirus is locking the `.exe` file during build.

**Solution A: Add Exclusions (Recommended)**

1. Open **Windows Security**
2. Go to **Virus & threat protection** → **Manage settings**
3. Scroll to **Exclusions** → **Add or remove exclusions**
4. Add these folders:
   - `C:\Users\<YourName>\AppData\Local\electron-builder\Cache`
   - `<ProjectPath>\out`

**OR via PowerShell (Admin required):**

```powershell
Add-MpPreference -ExclusionPath "C:\Users\$env:USERNAME\AppData\Local\electron-builder\Cache"
Add-MpPreference -ExclusionPath "$PWD\out"
```

**Solution B: Disable Defender Temporarily**

1. Open **Windows Security**
2. Go to **Virus & threat protection**
3. **Manage settings**
4. Turn off **Real-time protection** (temporary)
5. Run `npm run package`
6. **Re-enable** Real-time protection

**Solution C: Clean Build**

```powershell
# Kill any running processes
taskkill /F /IM Browse4Extract.exe 2>$null
taskkill /F /IM electron.exe 2>$null

# Clean output directories
Remove-Item -Path "out" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue

# Clear electron-builder cache
Remove-Item -Path "$env:LOCALAPPDATA\electron-builder\Cache" -Recurse -Force -ErrorAction SilentlyContinue

# Rebuild
npm run build
npm run package
```

**Solution D: Use Build Script**

Create `scripts/build-windows.ps1`:

```powershell
Write-Host "🧹 Cleaning up processes..."
taskkill /F /IM Browse4Extract.exe 2>$null
taskkill /F /IM electron.exe 2>$null

Write-Host "🧹 Cleaning output directories..."
Remove-Item -Path "out" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "🔨 Building..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!"
    exit $LASTEXITCODE
}

Write-Host "📦 Packaging..."
npm run package
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Packaging failed!"
    exit $LASTEXITCODE
}

Write-Host "✅ Build successful!"
```

**Run:**
```powershell
.\scripts\build-windows.ps1
```

---

### Issue 2: Icon Not Showing

**Symptom:** Packaged app shows default Electron icon instead of Browse4Extract icon.

**Cause:** Icon file format issue or path incorrect.

**Solution:**

1. **Verify icon exists:**
   ```bash
   dir assets\app_image.ico
   ```

2. **Regenerate icon** (if corrupted):
   ```bash
   npm install -g png2icons
   png2icons assets/app_image.png --icns --ico --output assets/
   ```

3. **Check package.json:**
   ```json
   {
     "build": {
       "win": {
         "icon": "assets/app_image.ico"
       }
     }
   }
   ```

4. **Rebuild:**
   ```bash
   npm run package
   ```

---

### Issue 3: Dependencies Not Found

**Symptom:**
```
Error: Cannot find module 'puppeteer'
```

**Cause:** Dependencies not installed or `node_modules` corrupted.

**Solution:**

```bash
# Delete node_modules and package-lock.json
Remove-Item -Path "node_modules" -Recurse -Force
Remove-Item -Path "package-lock.json" -Force

# Reinstall
npm install
```

---

### Issue 4: TypeScript Errors

**Symptom:**
```
TS2304: Cannot find name 'BrowserWindow'
```

**Cause:** TypeScript types not installed or outdated.

**Solution:**

```bash
npm install --save-dev @types/node @types/electron
```

---

### Issue 5: Webpack Build Fails

**Symptom:**
```
ERROR in ./src/main/main.ts
Module not found: Error: Can't resolve 'electron'
```

**Cause:** Webpack configuration issue or missing dependencies.

**Solution:**

1. **Check webpack.main.config.js:**
   ```javascript
   externals: {
     electron: 'commonjs electron'
   }
   ```

2. **Verify Electron is installed:**
   ```bash
   npm list electron
   ```

3. **Reinstall if needed:**
   ```bash
   npm install --save-dev electron
   ```

---

### Issue 6: "Out of Memory" Error

**Symptom:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

**Cause:** Node.js default memory limit exceeded during build.

**Solution:**

**Temporary (one-time):**
```bash
set NODE_OPTIONS=--max_old_space_size=4096
npm run build
```

**Permanent (add to package.json):**
```json
{
  "scripts": {
    "build": "cross-env NODE_OPTIONS=--max_old_space_size=4096 npm run build:main && npm run build:renderer"
  }
}
```

---

### Issue 7: Permission Errors

**Symptom:**
```
EACCES: permission denied
```

**Cause:** Insufficient permissions to write to output directory.

**Solutions:**

**A) Run as Administrator:**
- Right-click terminal → **Run as Administrator**

**B) Change output directory permissions:**
```powershell
icacls "out" /grant Users:F /T
```

**C) Use different output directory:**
```json
// package.json
{
  "build": {
    "directories": {
      "output": "C:/Temp/Browse4Extract-Build"
    }
  }
}
```

---

## Advanced Configuration

### Code Signing (Optional)

**Note:** Browse4Extract is currently built without code signing (`CSC_IDENTITY_AUTO_DISCOVERY=false`).

**To enable code signing:**

1. **Obtain code signing certificate:**
   - Purchase from DigiCert, Sectigo, etc.
   - Price: ~$200-500/year

2. **Install certificate:**
   - Install to Windows Certificate Store
   - Or provide PFX file

3. **Update package.json:**
   ```json
   {
     "build": {
       "win": {
         "certificateFile": "path/to/certificate.pfx",
         "certificatePassword": "password",
         "sign": "./scripts/sign.js"
       }
     }
   }
   ```

4. **Package:**
   ```bash
   npm run package
   ```

**Benefits:**
- ✅ No SmartScreen warnings
- ✅ Verified publisher
- ✅ Increased user trust

---

### Custom Installer (NSIS)

**Location:** `build/installer.nsh`

**Example customizations:**

```nsis
; Custom install messages
!define MUI_WELCOMEPAGE_TITLE "Install Browse4Extract"
!define MUI_WELCOMEPAGE_TEXT "Setup will guide you through the installation."

; Custom install directory
!define INSTALL_DIR "$PROGRAMFILES64\Browse4Extract"

; Registry keys
WriteRegStr HKLM "Software\Browse4Extract" "InstallPath" "$INSTDIR"

; Desktop shortcut
CreateShortcut "$DESKTOP\Browse4Extract.lnk" "$INSTDIR\Browse4Extract.exe"
```

---

### Multi-Target Build

**Build for all platforms:**

```json
// package.json
{
  "scripts": {
    "package:all": "npm run build && electron-builder -wml"
  }
}
```

**Flags:**
- `-w` = Windows
- `-m` = macOS
- `-l` = Linux

**Note:** macOS build requires macOS host (or CI/CD service).

---

## Build Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Run in development mode with hot-reload |
| `dev:renderer` | - | Start webpack dev server for renderer |
| `dev:main` | - | Build main process with watch mode |
| `build` | `npm run build` | Build for production (both main + renderer) |
| `build:main` | - | Build main process only |
| `build:renderer` | - | Build renderer process only |
| `start` | `npm run start` | Run built app (must build first) |
| `package` | `npm run package` | Create distributable (installer + portable) |
| `package:dev` | `npm run package:dev` | Quick package (unpacked only) |

---

## Build Output Structure

```
out/
├── win-unpacked/                   # Unpacked application
│   ├── Browse4Extract.exe         # Main executable (200+ MB)
│   ├── resources/
│   │   ├── app.asar               # Application code (bundled)
│   │   └── assets/                # Icons, images
│   ├── locales/                   # Chromium locales
│   ├── *.dll                      # Electron runtime DLLs
│   └── *.pak                      # Chromium resources
│
├── Browse4Extract Setup 1.1.1.exe  # NSIS Installer (~220 MB)
└── Browse4Extract-1.1.1-win.zip    # Portable ZIP (~210 MB)
```

---

## Performance Optimization

### Faster Builds

**1. Use SSD for project directory**

**2. Exclude from antivirus:**
- Project directory
- `node_modules/`
- `out/`

**3. Increase Node.js memory:**
```bash
set NODE_OPTIONS=--max_old_space_size=8192
```

**4. Use npm ci instead of npm install:**
```bash
npm ci  # Faster, uses exact package-lock.json versions
```

**5. Parallelize builds:**
```json
{
  "scripts": {
    "build": "concurrently \"npm run build:main\" \"npm run build:renderer\""
  }
}
```

---

## Continuous Integration (CI/CD)

### GitHub Actions Example

```yaml
# .github/workflows/build-windows.yml
name: Build Windows

on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]

jobs:
  build:
    runs-on: windows-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: 18

    - name: Install dependencies
      run: npm ci

    - name: Build
      run: npm run build

    - name: Package
      run: npm run package
      env:
        CSC_IDENTITY_AUTO_DISCOVERY: false

    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: Browse4Extract-Windows
        path: out/Browse4Extract Setup *.exe
```

---

## FAQ

**Q: Why is the build so large (200+ MB)?**
A: Electron bundles the entire Chromium browser. This is normal for Electron apps.

**Q: Can I reduce the build size?**
A: Options are limited. You can:
- Remove unused dependencies
- Enable asar compression (already enabled)
- Use electron-builder's compression options

**Q: How long does a full build take?**
A: Typical times:
- Clean install: 2-5 minutes
- Build: 20-40 seconds
- Package: 2-4 minutes

**Q: Can I build on Windows 7/8?**
A: Browse4Extract requires **Windows 10** or later due to Electron 39.

**Q: Do I need an internet connection to build?**
A: Only for `npm install`. Building and packaging can be done offline.

---

## Next Steps

After successful build:
- Test the packaged application
- Verify all features work
- Check Windows Defender doesn't flag it
- Create GitHub Release
- Distribute to users

---

## References

- [electron-builder Documentation](https://www.electron.build/)
- [Electron Packaging Guide](https://www.electronjs.org/docs/latest/tutorial/application-distribution)
- [NSIS Documentation](https://nsis.sourceforge.io/Docs/)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)

---

**Last Updated:** 2025-11-12
**Windows Version Tested:** Windows 10/11
