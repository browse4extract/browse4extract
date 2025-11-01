# Development Guide - Browse4Extract

This guide covers the technical architecture, development workflow, and advanced features of Browse4Extract.

## Table of Contents

- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Core Features](#core-features)
- [Visual Element Picker](#visual-element-picker)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)

## Architecture

Browse4Extract is built using Electron with a React frontend and TypeScript throughout.

### Process Model

**Main Process** (`src/main/`)
- Electron main process
- Puppeteer scraping logic
- File system operations
- IPC communication handler
- Discord RPC integration

**Renderer Process** (`src/renderer/`)
- React UI components
- User interaction handling
- Real-time data display
- State management

**Preload Scripts** (`src/preload/`)
- Secure bridge between main and renderer
- Exposes safe IPC methods to renderer
- Context isolation enabled

### Security Architecture

```
┌─────────────────────────────────────────┐
│          Renderer Process               │
│  (React UI - Sandboxed Browser)        │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   contextBridge API               │ │
│  │   (Preload Script)                │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
                  │
                  │ IPC Messages
                  │
┌─────────────────────────────────────────┐
│          Main Process                   │
│  (Node.js with full system access)     │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Scraper                          │ │
│  │  ConfigManager                    │ │
│  │  DiscordRPC                       │ │
│  │  File Operations                  │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Security Features**:
- `contextIsolation: true`
- `nodeIntegration: false`
- Secure IPC communication
- Input validation and sanitization
- No hardcoded secrets

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | Electron | 39.0.0 | Cross-platform desktop app |
| **Language** | TypeScript | 5.3.2 | Type-safe development |
| **UI Library** | React | 18.2.0 | Component-based UI |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS |
| **Scraping** | Puppeteer | 24.0.0 | Headless browser automation |
| **Stealth** | puppeteer-extra-plugin-stealth | 2.11.2 | Anti-detection |
| **Ad Blocking** | puppeteer-extra-plugin-adblocker | 2.13.6 | Block ads/trackers |
| **Excel Export** | ExcelJS | 4.4.0 | XLSX file generation |
| **Discord** | discord-rpc | 4.0.1 | Rich Presence integration |
| **Build Tool** | Webpack | 5.89.0 | Module bundling |
| **Packaging** | electron-builder | 24.9.1 | Application packaging |

## Project Structure

```
Browse4Extract/
├── src/
│   ├── main/                   # Main process (Node.js)
│   │   ├── main.ts            # Entry point, window management
│   │   ├── scraper.ts         # Puppeteer scraping logic
│   │   ├── elementPicker.ts   # Visual element picker overlay
│   │   ├── cookieHandler.ts   # Cookie consent handling
│   │   ├── discordRpc.ts      # Discord Rich Presence
│   │   ├── configManager.ts   # Settings management
│   │   └── templateManager.ts # Profile (.b4e) management
│   │
│   ├── renderer/               # Renderer process (React)
│   │   ├── App.tsx            # Main React component
│   │   ├── index.tsx          # React entry point
│   │   └── tailwind.css       # Tailwind styles
│   │
│   ├── preload/                # Preload scripts
│   │   └── preload.ts         # Context bridge API
│   │
│   └── types/                  # TypeScript definitions
│       └── types.ts           # Shared type definitions
│
├── assets/                     # Application resources
│   ├── app_image.ico          # Windows icon
│   ├── app_image.png          # macOS/Linux icon
│   └── app_image.psd          # Source icon file
│
├── dist/                       # Compiled output
├── out/                        # Packaged applications
├── docs/                       # Documentation
│
├── webpack.main.config.js      # Webpack config for main process
├── webpack.renderer.config.js  # Webpack config for renderer
├── tsconfig.json              # TypeScript configuration
├── electron-builder.yml       # Packaging configuration
└── package.json               # Dependencies and scripts
```

## Core Features

### 1. Smart Auto-Scroll

**Purpose**: Load lazy-loaded content before extraction

**Implementation** (`src/main/scraper.ts:81-110`):
```typescript
private async autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300; // Scroll increment

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0); // Return to top
          setTimeout(resolve, 300);
        }
      }, 300); // 300ms between scrolls
    });
  });
}
```

**Benefits**:
- ✅ Loads lazy-loaded images, articles, products
- ✅ Compatible with infinite scroll
- ✅ Ensures complete data extraction
- ✅ Returns to top automatically

### 2. Cookie Consent Handling

**Purpose**: Automatically handle cookie banners and consent popups

**Implementation** (`src/main/cookieHandler.ts`):

**Detection Methods**:
1. **CSS Selectors** - 50+ patterns for major CMPs
2. **Text Content** - Detects "accept", "consent", "cookie" keywords
3. **Aria Labels** - Accessibility attributes

**Supported CMPs**:
- OneTrust
- Didomi
- Usercentrics
- Quantcast
- TrustArc
- CookieBot
- And many more...

**Auto-Actions**:
```typescript
// Try multiple strategies
1. Click "Accept All" buttons
2. Close modal dialogs
3. Click "Agree" links
4. Remove overlay elements
```

### 3. Visual Element Picker

**Purpose**: Click directly on webpage elements to generate selectors

**Architecture**:
```
User clicks "Pick Element" button
         ↓
Main process opens picker browser
         ↓
Inject overlay script (elementPicker.ts)
         ↓
User hovers/clicks elements
         ↓
Generate optimal CSS selector
         ↓
Return selector + metadata to app
         ↓
Auto-fill extractor configuration
```

**Features**:
- Interactive overlay with visual feedback
- Smart selector generation
- Automatic exclusion of consent elements
- Navigation blocking
- Real-time preview

See [Visual Element Picker](#visual-element-picker) section for details.

### 4. Export Formats

#### JSON Export
```typescript
const jsonData = JSON.stringify(results, null, 2);
fs.writeFileSync(outputPath, jsonData);
```

#### CSV Export
```typescript
const csvHeader = Object.keys(results[0]).join(',') + '\n';
const csvRows = results.map(row =>
  Object.values(row).map(escapeCSV).join(',')
).join('\n');
```

#### Excel Export (ExcelJS)
```typescript
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Data');

// Add headers with styling
worksheet.addRow(headers);
worksheet.getRow(1).font = { bold: true };

// Add data rows
results.forEach(row => worksheet.addRow(row));

// Auto-size columns
worksheet.columns.forEach(column => {
  column.width = Math.max(10, ...column.values.map(v =>
    String(v || '').length
  ));
});

await workbook.xlsx.writeFile(outputPath);
```

### 5. Discord Rich Presence

**States**:
- 💤 Idle - Waiting for action
- 🔍 Scraping - Extraction in progress
- ✅ Completed - Successfully finished
- ❌ Error - Extraction failed

**Dynamic Progress**:
```typescript
const progress = (extracted / total) * 100;
const emoji = progress < 25 ? '🔍' :
              progress < 50 ? '📊' :
              progress < 75 ? '⚡' : '🚀';

await rpc.setActivity({
  details: `${emoji} Extracting from ${domain}`,
  state: `${extracted}/${total} items (${progress}%)`,
  largeImageKey: 'scraping',
  smallImageKey: 'logo',
  startTimestamp: Date.now()
});
```

**Features**:
- Real-time progress updates
- Elapsed time tracking
- Contextual buttons
- Auto-reconnection
- Optional (gracefully disabled if Discord not running)

## Visual Element Picker

The Visual Element Picker is the most advanced feature, allowing users to select elements by clicking directly on the page.

### Architecture

**Flow**:
```
1. User clicks "Pick Element" button
         ↓
2. Main process creates new browser window (Puppeteer)
         ↓
3. Navigate to target URL
         ↓
4. Inject picker overlay script via page.evaluate()
         ↓
5. User interacts with overlay
         ↓
6. On element selection, resolve Promise with data
         ↓
7. Close browser and return to main app
         ↓
8. Auto-fill selector and extraction type
```

### Overlay Script

**Location**: `src/main/elementPicker.ts`

**Components**:
1. **Banner** - Instructions at top of page
2. **Highlight Box** - Visual feedback on hover
3. **Tooltip** - Shows selector in real-time
4. **Event Handlers** - Mouse, keyboard, click events

### Selector Generation Strategy

**Priority Order**:
```typescript
1. ID selector (most reliable)
   Example: #product-123

2. Class-based selector
   Example: .product-card.featured

3. Attribute selector
   Example: [data-id="123"]

4. Structural selector (last resort)
   Example: div > article:nth-child(2)
```

**Implementation**:
```typescript
function generateSelector(element: Element): string {
  // Priority 1: ID
  if (element.id) {
    return `#${element.id}`;
  }

  // Priority 2: Classes
  if (element.classList.length > 0) {
    const classes = Array.from(element.classList).join('.');
    return `.${classes}`;
  }

  // Priority 3: nth-child
  const parent = element.parentElement;
  if (parent) {
    const index = Array.from(parent.children).indexOf(element) + 1;
    return `${element.tagName.toLowerCase()}:nth-child(${index})`;
  }

  return element.tagName.toLowerCase();
}
```

### Navigation Blocking

**Problem**: Clicking links would navigate away and break picking

**Solution**: Triple prevention
```typescript
// 1. On click event
element.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}, true);

// 2. Global link blocker
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'A' || target.closest('a')) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
}, true);

// 3. Form submission blocker
document.addEventListener('submit', (e) => {
  e.preventDefault();
}, true);
```

**Result**: 100% safe - no accidental navigation

### Consent Element Exclusion

**Excluded Patterns** (`src/main/elementPicker.ts:35-66`):

**IDs**:
- `onetrust-accept-btn-handler`
- `cookie-consent-accept`
- `didomi-notice-agree-button`
- `acceptAllButton`
- Elements from the picker overlay itself

**Classes**:
- `onetrust-close-btn-handler`
- `cookie-consent-accept`
- `didomi-button`
- `fc-cta-consent`
- `consent-accept`, `cookie-accept`
- `accept-all`, `acceptAll`

**Smart Detection**:
```typescript
function isExcludedElement(el: HTMLElement): boolean {
  // Check IDs
  if (EXCLUDED_IDS.includes(el.id)) return true;

  // Check classes
  if (el.classList.some(cls => EXCLUDED_CLASSES.includes(cls))) {
    return true;
  }

  // Check aria-labels
  const ariaLabel = el.getAttribute('aria-label')?.toLowerCase();
  if (ariaLabel && EXCLUDED_ARIA_LABELS.some(label =>
    ariaLabel.includes(label)
  )) {
    return true;
  }

  // Keyword detection in buttons/links
  const text = el.textContent?.toLowerCase() || '';
  if ((el.tagName === 'BUTTON' || el.tagName === 'A') &&
      (text.includes('cookie') ||
       text.includes('consent') ||
       text.includes('accept'))) {
    return true;
  }

  return false;
}
```

**User Feedback**:
- Hover on excluded element → No highlight
- Click on excluded element → Red banner with error message
- Auto-recovery → Banner returns to blue after 2 seconds

### Visual Feedback States

| State | Border Color | Background | Banner | Duration |
|-------|-------------|------------|---------|----------|
| **Hover** | Blue (#4fc3f7) | Transparent | "Click on any element..." | Until move |
| **Excluded Hover** | None | None | Same | - |
| **Excluded Click** | None | None | Red banner with error | 2 seconds |
| **Selection** | Green (#4caf50) | Green semi-transparent | "✓ Element selected!" | 2 seconds |

**Selection Confirmation**:
```typescript
// Change to green confirmation
highlightBox.style.border = '4px solid #4caf50';
highlightBox.style.background = 'rgba(76, 175, 80, 0.2)';
highlightBox.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.5)';

banner.textContent = '✓ Element selected! Closing in 2 seconds...';
banner.style.background = '#4caf50';

// Auto-close after 2 seconds
setTimeout(() => cleanup(), 2000);
```

### Auto-Detection of Extraction Type

**Heuristics**:
```typescript
function detectExtractionType(element: HTMLElement): ExtractorType {
  const tagName = element.tagName.toLowerCase();

  // Images → src attribute
  if (tagName === 'img') {
    return { type: 'attribute', attribute: 'src' };
  }

  // Links → href attribute
  if (tagName === 'a') {
    return { type: 'attribute', attribute: 'href' };
  }

  // Contains link → child link
  if (element.querySelector('a')) {
    return { type: 'child_link' };
  }

  // Contains image → image src
  if (element.querySelector('img')) {
    return { type: 'attribute', attribute: 'src', selector: 'img' };
  }

  // Default → text content
  return { type: 'text' };
}
```

### Error Handling

**Graceful Failures**:
```typescript
try {
  const result = await pickElement(url);
  return result;
} catch (error) {
  if (error.message === 'User cancelled') {
    // ESC pressed - normal behavior
    return { cancelled: true };
  }

  // Other errors
  logError(`Picker error: ${error.message}`);
  return { success: false, error: error.message };
}
```

**Cleanup**:
```typescript
const cleanup = () => {
  // Remove all event listeners
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('click', preventNavigation, true);
  document.removeEventListener('submit', preventNavigation, true);

  // Remove DOM elements
  overlay?.remove();
  banner?.remove();
  tooltip?.remove();

  // Clear global state
  delete (window as any).__browse4extract_isExcludedElement;
};
```

## Development Workflow

### Setup

```bash
# Clone repository
git clone https://github.com/Sielanse/Browse4Extract.git
cd Browse4Extract

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Discord Client ID (optional)
```

### Development

```bash
# Start development mode
npm run dev

# In another terminal
npm start
```

**Hot Reload**:
- Renderer changes → Auto-refresh
- Main process changes → Manual restart needed

### Debugging

**Renderer Process**:
```typescript
// In main.ts, development mode
mainWindow.webContents.openDevTools();
```

**Main Process**:
```bash
# Run with debugging
npm start -- --inspect=5858

# Attach debugger in VS Code or Chrome
```

**Puppeteer Browser**:
```typescript
// Enable debug mode in scraper
const browser = await puppeteer.launch({
  headless: false,  // See browser
  devtools: true,   // Open DevTools
  slowMo: 100       // Slow down actions
});
```

### Building

```bash
# Build for production
npm run build

# Package application
npm run package

# Quick package (dev build)
npm run package:dev
```

### Testing Changes

1. **Unit Tests** (when available)
```bash
npm test
```

2. **Manual Testing**:
   - Test each feature
   - Try different websites
   - Test error scenarios
   - Verify export formats
   - Check Discord integration

3. **Build Testing**:
```bash
npm run build
npm start
```

## Code Standards

### TypeScript

**Types for Everything**:
```typescript
// Good
function extractData(
  selector: string,
  type: ExtractorType
): Promise<string[]>

// Bad
function extractData(selector, type)
```

**Avoid `any`**:
```typescript
// Good
interface ScrapedData {
  [key: string]: string | null;
}

// Bad
let data: any = {};
```

**Use Interfaces**:
```typescript
interface ScrapingConfig {
  url: string;
  fileName: string;
  extractors: Extractor[];
  debugMode: boolean;
}
```

### React

**Functional Components**:
```typescript
// Good
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  return <div>...</div>;
};

// Avoid class components
```

**Hooks**:
```typescript
const [state, setState] = useState<string>('');
const value = useMemo(() => expensiveCalc(), [dep]);
useEffect(() => {
  // Side effects
}, [deps]);
```

**TypeScript Props**:
```typescript
interface ComponentProps {
  title: string;
  onClick: () => void;
  optional?: boolean;
}

const Component: React.FC<ComponentProps> = ({
  title,
  onClick,
  optional = false
}) => {
  // ...
};
```

### Code Style

**Formatting**:
- 2 spaces indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line

**Naming**:
- `camelCase` for variables and functions
- `PascalCase` for types, interfaces, classes
- `UPPER_SNAKE_CASE` for constants

**Comments**:
```typescript
// Good: Explain WHY, not WHAT
// Calculate progress to show appropriate emoji
const progress = (current / total) * 100;

// Bad: Obvious comment
// Increment counter by 1
counter++;
```

### IPC Communication

**Main Process Handler**:
```typescript
ipcMain.handle('action-name', async (_event, arg1, arg2) => {
  try {
    const result = await performAction(arg1, arg2);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**Renderer Process Call**:
```typescript
const result = await window.electronAPI.actionName(arg1, arg2);
if (result.success) {
  // Handle success
} else {
  // Handle error
}
```

**Preload Bridge**:
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  actionName: (arg1: string, arg2: number) =>
    ipcRenderer.invoke('action-name', arg1, arg2)
});
```

## Testing

### Manual Testing Checklist

**Visual Element Picker**:
- [ ] Overlay appears correctly
- [ ] Elements highlight on hover
- [ ] Tooltip shows selector
- [ ] Click selects element
- [ ] Green confirmation appears
- [ ] ESC cancels selection
- [ ] Links don't navigate
- [ ] Consent elements excluded
- [ ] Selector auto-fills in app

**Scraping**:
- [ ] URL validation works
- [ ] Auto-scroll loads content
- [ ] Cookie banners handled
- [ ] Data extracts correctly
- [ ] Multiple extractors work
- [ ] Preview shows correct data
- [ ] Error handling works

**Export**:
- [ ] JSON export works
- [ ] CSV export works
- [ ] Excel export works
- [ ] Files saved correctly
- [ ] Data structure correct
- [ ] Special characters handled

**Profiles**:
- [ ] Save profile works
- [ ] Load profile works
- [ ] .b4e file valid JSON
- [ ] Double-click opens file
- [ ] Unsaved changes warning

**Settings**:
- [ ] Output folder changes
- [ ] Saves folder changes
- [ ] Discord RPC toggles
- [ ] Settings persist

**Discord**:
- [ ] Idle state shows
- [ ] Scraping state updates
- [ ] Progress percentage correct
- [ ] Completion state shows
- [ ] Error state shows
- [ ] Reconnection works

### Test Sites

**E-commerce** (lazy loading, images):
- Amazon
- eBay
- Etsy

**News** (cookie banners):
- News websites with various CMPs
- Test international sites

**Social** (infinite scroll):
- Reddit
- Twitter/X (with limitations)

## Performance Optimization

### Scraper Performance

**Efficient Selectors**:
```typescript
// Fast: Specific selector
page.$$('.product-card > h2.title')

// Slow: Broad selector
page.$$('div')
```

**Batch Operations**:
```typescript
// Good: Single page evaluation
const data = await page.$$eval('.item', items =>
  items.map(item => ({
    title: item.querySelector('h2')?.textContent,
    price: item.querySelector('.price')?.textContent
  }))
);

// Bad: Multiple evaluations
for (const item of items) {
  const title = await item.$eval('h2', el => el.textContent);
  const price = await item.$eval('.price', el => el.textContent);
}
```

### Memory Management

**Close Resources**:
```typescript
try {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // ... scraping logic

} finally {
  await page.close();
  await browser.close();
}
```

**Cleanup Event Listeners**:
```typescript
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('event', handler);

  return () => {
    window.removeEventListener('event', handler);
  };
}, []);
```

## Common Patterns

### Error Handling

```typescript
async function riskyOperation(): Promise<Result> {
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    logError('Operation failed', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

### Logging

```typescript
const log = (message: string, type: 'info' | 'error' | 'success') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);

  // Send to renderer
  mainWindow?.webContents.send('log', {
    message,
    type,
    timestamp
  });
};
```

### Configuration

```typescript
interface Config {
  outputPath: string;
  savesPath: string;
  discordRpcEnabled: boolean;
}

class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    const defaultConfig: Config = {
      outputPath: path.join(app.getPath('downloads'), 'Browse4Extract', 'outputs'),
      savesPath: path.join(app.getPath('downloads'), 'Browse4Extract', 'saves'),
      discordRpcEnabled: false
    };

    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        return { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
      }
    } catch (error) {
      logError('Failed to load config', error);
    }

    return defaultConfig;
  }

  updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  private saveConfig(): void {
    fs.writeFileSync(
      this.getConfigPath(),
      JSON.stringify(this.config, null, 2)
    );
  }
}
```

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Puppeteer Documentation](https://pptr.dev/)
- [React Documentation](https://reactjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

**Happy coding!** 🚀
