# Architecture

Complete architectural overview of Browse4Extract.

## Overview

Browse4Extract is built on Electron, following a **multi-process architecture** with clear separation between the main process (Node.js), renderer processes (React UI), and preload scripts (secure IPC bridge).

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                    (React 18 + Tailwind CSS)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ IPC (contextBridge)
┌────────────────────────────┴────────────────────────────────────┐
│                       Preload Scripts                           │
│              (Secure bridge - no Node.js access)                │
└────────────────────────────┬────────────────────────────────────┘
                             │ IPC (ipcRenderer ↔ ipcMain)
┌────────────────────────────┴────────────────────────────────────┐
│                      Main Process (Node.js)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Scraper    │  │   Sessions   │  │  Discord RPC │         │
│  │  (Puppeteer) │  │  (Encrypted) │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │    Logger    │  │   Network    │  │    Config    │         │
│  │ (Sanitized)  │  │   Security   │  │   Manager    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
Browse4Extract/
├── src/
│   ├── main/               # Main Process (Node.js environment)
│   │   ├── main.ts         # Entry point, window creation, IPC handlers
│   │   ├── scraper.ts      # Puppeteer scraping engine
│   │   ├── sessionManager.ts   # Encrypted session storage
│   │   ├── discordRpc.ts   # Discord Rich Presence
│   │   ├── elementPicker.ts    # Visual element picker
│   │   ├── configManager.ts    # App settings management
│   │   ├── cookieHandler.ts    # Cookie import/export
│   │   ├── Logger.ts       # Centralized logging system
│   │   ├── logSanitizer.ts # Sensitive data sanitization
│   │   ├── NetworkSecurityMonitor.ts  # Network traffic monitoring
│   │   └── systemInfo.ts   # System information collector
│   │
│   ├── renderer/           # Renderer Process (Browser environment)
│   │   ├── index.tsx       # Main UI entry point
│   │   ├── debug.tsx       # Debug tools UI
│   │   ├── App.tsx         # Main application component
│   │   ├── components/     # React components
│   │   │   ├── AdvancedLogsViewer.tsx
│   │   │   ├── ConfirmationModal.tsx
│   │   │   ├── CreditsModal.tsx
│   │   │   ├── DebugTitleBar.tsx
│   │   │   ├── ErrorModal.tsx
│   │   │   ├── SessionCreator.tsx
│   │   │   ├── SessionManager.tsx
│   │   │   ├── SessionSelector.tsx
│   │   │   └── ToastNotification.tsx
│   │   └── utils/          # Utility functions
│   │       └── buildInfo.ts
│   │
│   ├── preload/            # Preload Scripts (Isolated context)
│   │   └── preload.ts      # IPC bridge with contextBridge
│   │
│   └── types/              # TypeScript definitions
│       ├── types.ts        # Shared types
│       └── buildInfo.d.ts  # Build info types
│
├── assets/                 # Static assets
│   ├── app_image.png       # Application icon (PNG)
│   └── app_image.ico       # Application icon (ICO for Windows)
│
├── build/                  # Build configuration
│   └── installer.nsh       # NSIS installer customization
│
├── dist/                   # Compiled output (gitignored)
│   ├── main/               # Compiled main process
│   ├── renderer/           # Compiled renderer process
│   └── preload/            # Compiled preload scripts
│
└── out/                    # Packaged applications (gitignored)
    └── win-unpacked/       # Windows build output
```

## Key Systems

### 1. Scraper Engine (`scraper.ts`)

**Purpose:** Core web scraping functionality using Puppeteer.

**Key Features:**
- Puppeteer Stealth mode (bypass bot detection)
- Ad blocking plugin
- Cookie injection from sessions
- Smart scrolling for lazy-loaded content
- Network security monitoring integration
- XSS-safe DOM manipulation

**Architecture:**
```typescript
class ScraperEngine {
  async startScraping(config: ScrapingConfig): Promise<ScrapedData[]>
  async loadCookies(cookies: Cookie[]): Promise<void>
  async scrollPage(): Promise<void>
  async extractElements(extractors: Extractor[]): Promise<any[]>
}
```

**Security Measures:**
- SSRF protection: Blocks private IPs (10.x, 172.16-31.x, 192.168.x, localhost)
- XSS prevention: Uses `textContent` instead of `innerHTML`
- Input validation: URL format and protocol validation
- Network monitoring: Logs suspicious requests

### 2. Session Management (`sessionManager.ts`)

**Purpose:** Securely store and manage login sessions with encryption.

**Architecture:**
```typescript
class SessionManager {
  async createSession(name: string, loginUrl: string): Promise<Session>
  async saveSession(sessionId: string, cookies: Cookie[]): Promise<void>
  async loadSession(sessionId: string): Promise<Cookie[]>
  async deleteSession(sessionId: string): Promise<void>
  async testSession(sessionId: string): Promise<boolean>
}
```

**Storage:**
- **Metadata**: JSON file in `userData/sessions/`
- **Cookies**: Encrypted with Electron's `safeStorage` API
- **Platform-specific**: Uses OS credential managers (Keychain/Credential Manager/libsecret)

**Security:**
- Zero plaintext storage
- System-level encryption
- Automatic session expiry detection
- Secure cookie handling

See [SESSION_MANAGEMENT.md](SESSION_MANAGEMENT.md) for details.

### 3. Visual Element Picker (`elementPicker.ts`)

**Purpose:** Allow users to visually select elements on a webpage.

**How It Works:**
1. Opens a Puppeteer browser window
2. Injects CSS for hover highlighting
3. Injects JavaScript for click detection
4. User clicks on element
5. Generates optimal CSS selector with fallback strategies
6. Returns selector + suggested extraction type

**Selector Generation Strategy:**
```
Priority:
1. data-* attributes (most reliable)
2. id attribute
3. unique class combinations
4. nth-child selectors
5. tag + text content fallback
```

**Anti-Pattern Detection:**
- Automatically excludes cookie consent banners
- Ignores overlay elements
- Skips navigation menus unless explicitly selected

See [VISUAL_PICKER.md](VISUAL_PICKER.md) for details.

### 4. Centralized Logger (`Logger.ts`)

**Purpose:** Single source of truth for all application logs with automatic sanitization.

**Categories:**
- `nodejs` - Node.js core logs
- `electron` - Electron framework logs
- `puppeteer` - Puppeteer browser logs
- `Browse4Extract` - Application-specific logs

**Levels:**
- `debug` - Verbose debugging (only in dev mode)
- `info` - Informational messages
- `success` - Success confirmations
- `warning` - Non-critical issues
- `error` - Critical errors

**Features:**
- Auto-sanitizes sensitive data (passwords, tokens, cookies)
- Prevents recursive logging
- Broadcasts to Advanced Logs Viewer UI
- Console intercept for unified logging

### 5. Network Security Monitor (`NetworkSecurityMonitor.ts`)

**Purpose:** Monitor Puppeteer network traffic for suspicious patterns.

**Security Levels:**
- `relaxed` - Basic monitoring
- `normal` - Standard checks (default)
- `strict` - Enhanced detection
- `paranoid` - Maximum security

**Detection Patterns:**
- Large data exfiltration (>5MB responses)
- Sensitive data in URLs (passwords, tokens, API keys)
- Suspicious domains (known malicious hosts)
- Credential leakage in POST bodies
- Base64-encoded payloads

**Log Rotation:**
- Max size: 10MB per log file
- Backups: 5 rotating files
- Location: `userData/logs/suspicious.log`

### 6. Configuration Manager (`configManager.ts`)

**Purpose:** Manage application settings with persistence.

**Settings Schema:**
```typescript
interface AppSettings {
  outputFolder: string;        // Export destination
  savesFolder: string;         // Profile saves location
  discordRpcEnabled: boolean;  // Discord integration
  debugEnabled: boolean;       // Debug mode
  advancedLogsEnabled: boolean; // Advanced log viewer
  securityLevel: SecurityLevel; // Network monitoring level
}
```

**Storage:** `userData/config.json`

**Features:**
- Default values
- Validation
- Auto-migration for schema updates
- IPC-based updates

### 7. Discord Rich Presence (`discordRpc.ts`)

**Purpose:** Show scraping activity on Discord profile.

**States:**
- Idle
- Picking elements
- Scraping in progress
- Completed

**Configuration:**
- Client ID via environment variable
- Customizable details/state text
- Automatic reconnection
- Graceful degradation if Discord not running

See [DISCORD_SETUP.md](../DISCORD_SETUP.md) for setup.

## IPC Communication

Electron uses **Inter-Process Communication (IPC)** to bridge renderer and main processes.

### Architecture

```
Renderer (React)  →  Preload  →  Main (Node.js)
    │                   │             │
    └─── window.api ────┴─── ipcMain.handle()
```

### Example Flow: Save Session

```typescript
// 1. Renderer calls API
const result = await window.api.saveSession(sessionId, cookies);

// 2. Preload exposes API via contextBridge
contextBridge.exposeInMainWorld('api', {
  saveSession: (id, cookies) => ipcRenderer.invoke('save-session', id, cookies)
});

// 3. Main process handles request
ipcMain.handle('save-session', async (event, id, cookies) => {
  await sessionManager.saveSession(id, cookies);
  return { success: true };
});
```

### Security

- **Context Isolation**: Enabled by default
- **No Node Integration**: Renderer has no direct Node.js access
- **Whitelisted APIs**: Only explicitly exposed functions available
- **Input Validation**: All IPC inputs validated in main process

## Security Architecture

### Defense in Depth

```
Layer 1: Input Validation
  ↓ Validate all user inputs, URLs, selectors
Layer 2: Sandboxing
  ↓ Renderer process sandboxed, no Node.js access
Layer 3: IPC Security
  ↓ Context isolation, whitelisted APIs only
Layer 4: Data Sanitization
  ↓ Auto-sanitize logs, prevent credential leaks
Layer 5: Network Security
  ↓ SSRF protection, suspicious traffic detection
Layer 6: Encryption
  ↓ Encrypted session storage with safeStorage
```

### Attack Surface Mitigation

| Threat | Mitigation |
|--------|-----------|
| **XSS** | Use `textContent` instead of `innerHTML` |
| **SSRF** | Block private IPs and localhost |
| **Credential Theft** | Auto-sanitize logs, encrypted storage |
| **Code Injection** | No `eval()`, strict CSP |
| **Path Traversal** | Validate file paths, restrict to userData |
| **Malicious URLs** | URL validation, protocol whitelist |

See [SECURITY.md](SECURITY.md) for full details.

## Build and Packaging

### Build Process

```bash
npm run build
```

**Steps:**
1. **Build Main Process**: `webpack.main.config.js`
   - Compiles TypeScript
   - Bundles Node.js dependencies
   - Outputs to `dist/main/`

2. **Build Renderer Process**: `webpack.renderer.config.js`
   - Compiles React + TypeScript
   - Processes Tailwind CSS
   - Outputs to `dist/renderer/`

3. **Build Preload Scripts**: Included in main webpack config
   - Compiles preload.ts
   - Outputs to `dist/preload/`

### Packaging Process

```bash
npm run package
```

**Steps (electron-builder):**
1. Takes compiled `dist/` folder
2. Bundles with Electron runtime
3. Copies `assets/` folder
4. Uses `rcedit-x64.exe` to set metadata (Windows):
   - Application icon
   - Version info
   - Copyright
   - Product name
5. Creates installer (NSIS) and portable ZIP
6. Outputs to `out/` folder

**Platforms:**
- **Windows**: NSIS installer + ZIP archive
- **macOS**: DMG + ZIP archive
- **Linux**: AppImage + tar.gz archive

See [BUILD_WINDOWS.md](BUILD_WINDOWS.md) for Windows-specific instructions.

## Design System

### Color Palette

```css
/* Tailwind CSS custom theme */
:root {
  --color-primary: #3B82F6;    /* Blue */
  --color-success: #10B981;    /* Green */
  --color-warning: #F59E0B;    /* Amber */
  --color-danger: #EF4444;     /* Red */
  --color-dark: #1F2937;       /* Gray 800 */
  --color-darker: #111827;     /* Gray 900 */
}
```

### Component Library

- **@headlessui/react** - Accessible UI components (modals, dialogs)
- **@heroicons/react** - Icon library
- **lucide-react** - Additional icons
- Custom components in `src/renderer/components/`

### Typography

- **Font**: System font stack (optimized for each OS)
- **Sizes**: Tailwind default scale (text-sm, text-base, text-lg, etc.)
- **Weights**: Regular (400), Medium (500), Semibold (600), Bold (700)

## Performance Considerations

### Optimization Strategies

1. **Webpack Code Splitting**
   - Separate bundles for main and renderer
   - Lazy loading for heavy components

2. **React Optimization**
   - Memoization with `React.memo()`
   - `useMemo()` and `useCallback()` for expensive computations
   - Virtual scrolling for large lists

3. **Puppeteer Resource Management**
   - Close browsers when not in use
   - Limit concurrent browser instances
   - Disable images when not needed

4. **Log Rotation**
   - 10MB max log size
   - 5 backup files
   - Auto-cleanup old logs

## Deployment Process

### Release Workflow

1. **Version Bump**: `npm run release` (uses standard-version)
2. **Build**: `npm run build`
3. **Test**: `npm run start` - verify built app works
4. **Package**: `npm run package` - create distributables
5. **Upload**: Manually upload to GitHub Releases
6. **Publish**: Tag release and publish

### Versioning

- **Semantic Versioning**: MAJOR.MINOR.PATCH
- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, etc.
- **Automatic Changelog**: Generated by standard-version

### Distribution

- **GitHub Releases**: Primary distribution method
- **Auto-updates**: Not yet implemented (future feature)
- **Platforms**: Windows, macOS, Linux

## Environment Variables

```bash
# .env file
DISCORD_CLIENT_ID=your_discord_app_id  # Discord RPC
PROJECT_URL=https://github.com/browse4extract/browse4extract  # Project URL
```

## Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Electron | 39.0.0 |
| **Language** | TypeScript | 5.3.2 |
| **UI Library** | React | 18.2.0 |
| **Styling** | Tailwind CSS | 4.1.16 |
| **Browser Automation** | Puppeteer | 24.0.0 |
| **Stealth** | puppeteer-extra-plugin-stealth | 2.11.2 |
| **Ad Blocking** | puppeteer-extra-plugin-adblocker | 2.13.6 |
| **Excel Export** | ExcelJS | 4.4.0 |
| **Discord** | discord-rpc | 4.0.1 |
| **Build Tool** | Webpack | 5.89.0 |
| **Packager** | electron-builder | 24.9.1 |

## References

- [Electron Documentation](https://www.electronjs.org/docs)
- [Puppeteer API](https://pptr.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Next Steps:**
- Read [DEVELOPMENT.md](DEVELOPMENT.md) to set up your dev environment
- Read [ADDING_FEATURES.md](ADDING_FEATURES.md) to add new features
- Read [SECURITY.md](SECURITY.md) to understand security practices
