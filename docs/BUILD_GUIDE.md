# Build Guide - Browse4Extract

This guide covers building and packaging Browse4Extract for distribution.

## Development Builds

### Development Mode

Run the application with hot-reload for development:

```bash
# Option 1: Run all services together
npm run dev

# Then in another terminal
npm start
```

```bash
# Option 2: Run services separately (recommended for debugging)

# Terminal 1: React dev server
npm run dev:renderer

# Terminal 2: Compile main process
npm run dev:main

# Terminal 3: Start Electron
npm start
```

### Production Build

Compile for production without packaging:

```bash
npm run build
```

This creates optimized bundles in the `dist/` folder:
- `dist/main/` - Main process
- `dist/renderer/` - Renderer process
- `dist/preload/` - Preload scripts

## Packaging for Distribution

### Quick Package (Development)

Create an unpacked directory build (fastest):

```bash
npm run package:dev
```

Output: `out/win-unpacked/Browse4Extract.exe` (portable)

### Full Package (Production)

Create installer and portable versions:

```bash
npm run package
```

**Windows Output**:
- `out/Browse4Extract-Setup.exe` - NSIS installer
- `out/win-unpacked/` - Portable version

**macOS Output**:
- `out/Browse4Extract.dmg` - DMG installer
- `out/mac/` - Application bundle

**Linux Output**:
- `out/Browse4Extract.AppImage` - Portable AppImage
- `out/linux-unpacked/` - Unpacked application

## Build Warnings (Non-Critical)

### Electron-Builder Symlink Warnings

You may see errors like:

```
ERROR: Cannot create symbolic link: A required privilege is not held by the client.
: C:\Users\...\winCodeSign\...\darwin\10.12\lib\libcrypto.dylib
```

**These warnings can be SAFELY IGNORED** ✅

#### Why These Warnings Occur

- Electron-builder downloads `winCodeSign` containing macOS libraries
- On Windows, 7-Zip cannot create macOS symlinks without admin privileges
- These macOS files are **NOT needed** for Windows builds

#### Verification

The application is correctly packaged if you see:
```
✓ Application packaged successfully
```

The executable will be in: `out/win-unpacked/Browse4Extract.exe`

### Solutions (Optional)

**Option 1: Enable Windows Developer Mode** (Recommended for regular development)
1. Settings → Update & Security → For Developers
2. Enable "Developer Mode"
3. Restart computer

**Option 2: Run as Administrator** (Not recommended)
- Launch PowerShell/CMD as Administrator
- Run `npm run package`

**Option 3: Ignore Warnings** (Recommended)
- Warnings don't prevent packaging
- Application works normally
- Only affects Windows builds of macOS resources

## Platform-Specific Instructions

### Windows

**Prerequisites**:
- Windows 10/11
- Node.js 18+
- npm

**Build Commands**:
```bash
# Development
npm run dev

# Package
npm run package
```

**Code Signing** (Optional):
- Requires Windows code signing certificate
- Configure in `electron-builder.yml`
- See [electron-builder documentation](https://www.electron.build/code-signing)

### macOS

**Prerequisites**:
- macOS 10.13+
- Node.js 18+
- Xcode Command Line Tools: `xcode-select --install`

**Build Commands**:
```bash
# Development
npm run dev

# Package for both architectures
npm run package
```

**Code Signing** (Recommended):
- Requires Apple Developer account
- Certificate for "Developer ID Application"
- Configure `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables

**Notarization** (Required for distribution):
- Requires Apple Developer account
- Configure `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`
- See [electron-notarize documentation](https://github.com/electron/electron-notarize)

### Linux

**Prerequisites**:
- Linux (Ubuntu 18.04+ recommended)
- Node.js 18+
- Build tools: `sudo apt install build-essential`

**Build Commands**:
```bash
# Development
npm run dev

# Package
npm run package
```

**AppImage Requirements**:
- FUSE for AppImage: `sudo apt install fuse libfuse2`

## Advanced Configuration

### Environment Variables

Create `.env` file in project root:

```env
# Discord Rich Presence (Optional)
DISCORD_CLIENT_ID=your_discord_app_id

# Project URL (for Discord RPC)
PROJECT_URL=https://github.com/yourusername/browse4extract

# Build Configuration
NODE_ENV=production

# Code Signing (Optional)
CSC_LINK=/path/to/certificate.pfx
CSC_KEY_PASSWORD=your_certificate_password

# macOS Notarization (Optional)
APPLE_ID=your@apple.id
APPLE_ID_PASSWORD=app-specific-password
APPLE_TEAM_ID=your_team_id
```

### Electron Builder Configuration

Edit `electron-builder.yml` for custom build options:

```yaml
appId: com.yourcompany.browse4extract
productName: Browse4Extract

directories:
  output: out

# Windows Configuration
win:
  target:
    - nsis
    - portable
  icon: assets/app_image.ico

# macOS Configuration
mac:
  target:
    - dmg
    - zip
  icon: assets/app_image.png
  category: public.app-category.developer-tools

# Linux Configuration
linux:
  target:
    - AppImage
    - deb
  icon: assets/app_image.png
  category: Development
```

## Build Optimization

### Bundle Size Reduction

**Exclude Development Dependencies**:
```json
{
  "build": {
    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "!node_modules/@types/**/*"
    ]
  }
}
```

**Minimize Source Maps**:
- Production builds exclude source maps
- Reduces bundle size by ~30%

### Performance

**Webpack Production Mode**:
- Code minification
- Tree shaking
- Scope hoisting
- Automatically enabled in `npm run build`

**Electron Builder Compression**:
- NSIS installer compression
- macOS DMG optimization
- AppImage compression

## Continuous Integration

### GitHub Actions

The project includes `.github/workflows/build.yml` for automated builds:

**Triggers**:
- Push to `main` branch
- Pull requests
- Release tags (`v*`)

**Builds**:
- Windows (x64)
- macOS (x64, arm64)
- Linux (x64)

**Artifacts**:
- Uploaded for each platform
- Available in Actions tab
- 90-day retention

### Creating Releases

**Manual Release**:
1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Commit changes
4. Create and push tag:
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```
5. GitHub Actions builds and creates release automatically

**Release Assets**:
- Windows installer and portable
- macOS DMG for Intel and Apple Silicon
- Linux AppImage

## Testing Builds

### Local Testing

**Before Packaging**:
```bash
# Run build
npm run build

# Test in production mode
npm start
```

**After Packaging**:
1. Install/run packaged application
2. Test all features:
   - Visual element picker
   - Scraping functionality
   - Profile save/load
   - Export formats (JSON, CSV, Excel)
   - Discord integration (if enabled)
   - Settings configuration

### Automated Testing

```bash
# Run tests (when available)
npm test

# Type checking
npm run build
```

## Troubleshooting

### Build Fails

**Check Node Version**:
```bash
node --version  # Should be 18+
```

**Clean Build**:
```bash
# Remove build artifacts
rm -rf dist/ out/

# Clean dependencies
rm -rf node_modules/ package-lock.json
npm install

# Rebuild
npm run build
```

### Package Fails

**Check Electron Builder Version**:
```bash
npm list electron-builder
```

**Update Dependencies**:
```bash
npm update
```

**Check for Missing Assets**:
- Verify `assets/app_image.ico` exists (Windows)
- Verify `assets/app_image.png` exists (macOS/Linux)

### Large Bundle Size

**Analyze Bundle**:
```bash
# Install analyzer
npm install --save-dev webpack-bundle-analyzer

# Add to webpack config and rebuild
npm run build
```

**Common Issues**:
- Unnecessary dependencies included
- Source maps in production
- Unoptimized images

## Distribution

### Windows

**NSIS Installer**:
- One-click installation
- Desktop shortcut creation
- Start menu entry
- Uninstaller included

**Portable Version**:
- No installation required
- Run from any location
- Useful for USB drives

### macOS

**DMG Installer**:
- Drag-and-drop installation
- Background image customization
- App icon in Applications

**Notarization Required**:
- For distribution outside App Store
- Users won't see security warnings

### Linux

**AppImage**:
- Universal format
- No installation needed
- Works on most distributions
- Requires FUSE

**Distribution**:
- Make executable: `chmod +x Browse4Extract.AppImage`
- Run directly: `./Browse4Extract.AppImage`

## Security Considerations

### Code Signing

**Why Sign**:
- Users trust signed applications
- No OS security warnings
- Required for some platforms (macOS)

**How to Sign**:
- Windows: Purchase code signing certificate
- macOS: Apple Developer Program membership
- Linux: Not commonly signed

### Build Security

**Protect Secrets**:
- Never commit certificates
- Use environment variables
- Exclude `.env` in `.gitignore`

**CI/CD Secrets**:
- Store certificates in GitHub Secrets
- Encrypt sensitive values
- Use temporary credentials

## Resources

- [Electron Builder Docs](https://www.electron.build/)
- [Electron Docs](https://www.electronjs.org/docs)
- [Webpack Docs](https://webpack.js.org/)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)

## Checklist

Before releasing:
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Test all features
- [ ] Build succeeds without errors
- [ ] Test on target platforms
- [ ] Check bundle size
- [ ] Verify icons display correctly
- [ ] Test installation process
- [ ] Update documentation
- [ ] Create release notes
