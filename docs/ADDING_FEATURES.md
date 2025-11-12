# Adding Features

Step-by-step guide for adding new features to Browse4Extract.

## Overview

This guide walks you through the complete process of adding a new feature, from planning to testing. We'll use a real example: **Adding a "Duplicate Extractor" button**.

## Before You Start

### Prerequisites

- ✅ Development environment set up (see [DEVELOPMENT.md](DEVELOPMENT.md))
- ✅ Understanding of Electron architecture (see [ARCHITECTURE.md](ARCHITECTURE.md))
- ✅ Basic knowledge of TypeScript and React

### Planning Checklist

Before writing code, answer these questions:

- [ ] **What problem does this feature solve?**
- [ ] **Where will it be used?** (UI, main process, both?)
- [ ] **Does it need IPC communication?**
- [ ] **What new types/interfaces are needed?**
- [ ] **Are there security implications?**
- [ ] **How will it be tested?**

## Step-by-Step Process

### Step 1: Define Types

**Location:** `src/types/types.ts`

Add or update TypeScript interfaces for your feature.

**Example: Duplicate Extractor**

```typescript
export interface Extractor {
  id: string;
  name: string;
  selector: string;
  type: 'text' | 'attribute' | 'link' | 'image';
  attribute?: string;
  childSelector?: string;
  childType?: 'text' | 'link';
}

// Add utility type if needed
export type ExtractorInput = Omit<Extractor, 'id'>;
```

**Best Practices:**
- ✅ Use strict types (avoid `any`)
- ✅ Document complex types with JSDoc comments
- ✅ Export types that are used in multiple files
- ✅ Use `readonly` for immutable properties

### Step 2: Update Main Process (if needed)

**Location:** `src/main/*.ts`

Add business logic, IPC handlers, or system integrations.

**Example: No main process changes needed for UI-only feature**

**When you need main process changes:**
- File system operations
- Puppeteer/scraping logic
- Native system APIs
- Encryption/security operations
- Database operations

**Example: Adding IPC Handler**

```typescript
// src/main/main.ts

ipcMain.handle('duplicate-extractor', async (event, extractor: Extractor) => {
  // Business logic here
  const duplicated: Extractor = {
    ...extractor,
    id: `${extractor.id}-copy-${Date.now()}`,
    name: `${extractor.name} (Copy)`
  };

  return duplicated;
});
```

**Security Checklist:**
- [ ] Validate all inputs from renderer process
- [ ] Sanitize file paths (no path traversal)
- [ ] Check permissions before file operations
- [ ] Don't trust renderer data

### Step 3: Update Preload (if IPC needed)

**Location:** `src/preload/preload.ts`

Expose IPC methods to renderer process via `contextBridge`.

**Example: Expose Duplicate Function**

```typescript
// src/preload/preload.ts

contextBridge.exposeInMainWorld('api', {
  // ... existing methods

  duplicateExtractor: (extractor: Extractor): Promise<Extractor> =>
    ipcRenderer.invoke('duplicate-extractor', extractor),
});

// Update window interface in types
declare global {
  interface Window {
    api: {
      // ... existing methods
      duplicateExtractor: (extractor: Extractor) => Promise<Extractor>;
    };
  }
}
```

**Best Practices:**
- ✅ Only expose what's necessary
- ✅ Use TypeScript for type safety
- ✅ Keep API surface minimal
- ✅ Document each exposed method

### Step 4: Update UI Components

**Location:** `src/renderer/App.tsx` or `src/renderer/components/*.tsx`

Add React components and UI logic.

**Example: Add Duplicate Button**

```tsx
// src/renderer/App.tsx

const handleDuplicateExtractor = async (extractor: Extractor) => {
  try {
    // If using IPC:
    const duplicated = await window.api.duplicateExtractor(extractor);

    // Or if purely UI logic:
    const duplicated: Extractor = {
      ...extractor,
      id: `${extractor.id}-copy-${Date.now()}`,
      name: `${extractor.name} (Copy)`
    };

    setExtractors([...extractors, duplicated]);

    // Show success toast
    showToast('Extractor duplicated successfully', 'success');
  } catch (error) {
    console.error('Failed to duplicate extractor:', error);
    showToast('Failed to duplicate extractor', 'error');
  }
};

// In JSX:
<button
  onClick={() => handleDuplicateExtractor(extractor)}
  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
  aria-label="Duplicate extractor"
>
  <DocumentDuplicateIcon className="h-4 w-4" />
</button>
```

**Best Practices:**
- ✅ Handle errors gracefully
- ✅ Provide user feedback (toasts, modals)
- ✅ Use semantic HTML and ARIA labels
- ✅ Follow existing UI patterns
- ✅ Use Tailwind CSS classes consistently

### Step 5: Add Styling (if needed)

**Location:** `src/renderer/tailwind.css` or inline with Tailwind

For custom styles not available in Tailwind:

```css
/* src/renderer/tailwind.css */

.duplicate-button-animation {
  @apply transition-transform duration-200 hover:scale-110;
}
```

**Best Practices:**
- ✅ Prefer Tailwind utility classes
- ✅ Only add custom CSS when necessary
- ✅ Use CSS variables for theme colors
- ✅ Keep animations subtle and performant

### Step 6: Update Configuration (if needed)

**Location:** `src/main/configManager.ts`

If your feature needs persistent settings:

```typescript
// src/main/configManager.ts

export interface AppSettings {
  // ... existing settings
  duplicateAppendsCopy: boolean; // New setting
}

const DEFAULT_SETTINGS: AppSettings = {
  // ... existing defaults
  duplicateAppendsCopy: true,
};
```

**Then add UI in Settings:**

```tsx
// In Settings component
<label className="flex items-center">
  <input
    type="checkbox"
    checked={settings.duplicateAppendsCopy}
    onChange={(e) => updateSetting('duplicateAppendsCopy', e.target.checked)}
  />
  <span className="ml-2">Append "(Copy)" to duplicated extractors</span>
</label>
```

### Step 7: Test Your Feature

**Manual Testing Checklist:**

- [ ] Feature works as expected (happy path)
- [ ] Error handling works (invalid inputs)
- [ ] UI updates correctly
- [ ] No console errors
- [ ] Settings persist after restart (if applicable)
- [ ] Works on dev build (`npm run dev`)
- [ ] Works on production build (`npm run build && npm start`)

**Example Test Cases:**

| Test Case | Expected Result |
|-----------|----------------|
| Duplicate simple extractor | Creates exact copy with new ID |
| Duplicate extractor with child | Child selector also duplicated |
| Duplicate 10 times rapidly | All duplicates created, no race conditions |
| Duplicate then delete original | Duplicate still works independently |

**Debugging Tips:**

```typescript
// Add debug logs (remove before commit)
console.log('[DEBUG] Duplicating extractor:', extractor);

// Use React DevTools to inspect state
// Use Electron DevTools to inspect main process

// Check IPC communication
ipcRenderer.on('duplicate-extractor', (event, ...args) => {
  console.log('IPC called with:', args);
});
```

### Step 8: Document Your Feature

**Update README.md:**

```markdown
### 🎯 **Visual Element Picker**
- Click directly on webpage elements to select them
- **Duplicate extractors** with one click (NEW!)
- Smart selector generation with fallback strategies
```

**Add to CHANGELOG.md (if releasing):**

```markdown
### Features
- **Duplicate Extractor**: Add ability to duplicate extractors with one click
```

**Create feature-specific docs (if complex):**

```markdown
# docs/DUPLICATE_FEATURE.md

## How Duplication Works
...
```

### Step 9: Commit Your Changes

**Commit Message Format:**

```bash
# Feature
git commit -m "feat: add duplicate extractor button"

# Bug fix
git commit -m "fix: prevent duplicate IDs when duplicating extractors"

# Refactor
git commit -m "refactor: extract duplicate logic to utility function"

# Docs
git commit -m "docs: add duplicate feature to README"
```

**Use Conventional Commits:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `docs:` - Documentation only
- `style:` - Code style changes (formatting, etc.)
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Common Feature Patterns

### Pattern 1: Adding a New Modal

```tsx
// 1. Create component
const MyModal = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <Dialog.Panel>
        <Dialog.Title>My Feature</Dialog.Title>
        {/* Content */}
      </Dialog.Panel>
    </Dialog>
  );
};

// 2. Add state
const [isMyModalOpen, setIsMyModalOpen] = useState(false);

// 3. Add trigger
<button onClick={() => setIsMyModalOpen(true)}>Open</button>

// 4. Render modal
<MyModal isOpen={isMyModalOpen} onClose={() => setIsMyModalOpen(false)} />
```

### Pattern 2: Adding Main Process Logic

```typescript
// 1. Create handler file (src/main/myFeature.ts)
export class MyFeatureManager {
  async doSomething(input: string): Promise<Result> {
    // Business logic
    return result;
  }
}

// 2. Register IPC handler (src/main/main.ts)
const myFeature = new MyFeatureManager();

ipcMain.handle('my-feature-action', async (event, input) => {
  return await myFeature.doSomething(input);
});

// 3. Expose in preload (src/preload/preload.ts)
contextBridge.exposeInMainWorld('api', {
  myFeatureAction: (input: string) => ipcRenderer.invoke('my-feature-action', input)
});

// 4. Use in renderer
const result = await window.api.myFeatureAction('test');
```

### Pattern 3: Adding Persistent Data

```typescript
// 1. Define schema
interface MyData {
  id: string;
  value: string;
}

// 2. Create manager
class MyDataManager {
  private dataPath: string;

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'mydata.json');
  }

  async save(data: MyData[]): Promise<void> {
    await fs.promises.writeFile(this.dataPath, JSON.stringify(data, null, 2));
  }

  async load(): Promise<MyData[]> {
    const content = await fs.promises.readFile(this.dataPath, 'utf-8');
    return JSON.parse(content);
  }
}
```

## Security Considerations

### Input Validation

```typescript
// ALWAYS validate inputs from renderer
ipcMain.handle('my-feature', async (event, input: string) => {
  // Validate type
  if (typeof input !== 'string') {
    throw new Error('Invalid input type');
  }

  // Validate format
  if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
    throw new Error('Invalid input format');
  }

  // Validate length
  if (input.length > 1000) {
    throw new Error('Input too long');
  }

  // Now safe to use
  return processInput(input);
});
```

### Path Traversal Prevention

```typescript
// NEVER use user input directly in file paths
import path from 'path';

const userDataPath = app.getPath('userData');
const safePath = path.join(userDataPath, 'profiles', sanitizeFilename(userInput));

// Ensure path is within userData
if (!safePath.startsWith(userDataPath)) {
  throw new Error('Invalid path');
}
```

### XSS Prevention

```tsx
// NEVER use innerHTML with user content
// ❌ BAD
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ GOOD
<div>{userInput}</div>

// ✅ GOOD for DOM manipulation
element.textContent = userInput; // Auto-escapes
```

## Performance Best Practices

### Debouncing User Input

```typescript
import { useMemo, useState, useEffect } from 'react';

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// Usage
const debouncedSearch = useDebounce(searchTerm, 500);
```

### Memoization

```typescript
// Expensive computations
const sortedExtractors = useMemo(() => {
  return extractors.sort((a, b) => a.name.localeCompare(b.name));
}, [extractors]);

// Callbacks
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

## Troubleshooting

### Common Issues

**Issue: IPC not working**
- ✅ Check preload script is loaded
- ✅ Verify `contextIsolation: true` in BrowserWindow options
- ✅ Check `ipcMain.handle()` matches `ipcRenderer.invoke()`
- ✅ Ensure types are properly exported

**Issue: Types not recognized**
- ✅ Restart TypeScript server in IDE
- ✅ Run `npm run build` to regenerate types
- ✅ Check `tsconfig.json` includes your files

**Issue: Styles not applying**
- ✅ Ensure Tailwind purge includes your files
- ✅ Check class names are correct (typos)
- ✅ Verify custom CSS is imported
- ✅ Check browser DevTools for applied styles

**Issue: Feature works in dev but not in production**
- ✅ Check webpack config includes your files
- ✅ Ensure assets are copied correctly
- ✅ Verify paths are relative, not absolute
- ✅ Test production build: `npm run build && npm start`

## Example: Complete Feature Implementation

**Feature: Export Progress Bar**

<details>
<summary>Click to expand full example</summary>

```typescript
// 1. Types (src/types/types.ts)
export interface ExportProgress {
  current: number;
  total: number;
  status: 'idle' | 'exporting' | 'complete' | 'error';
}

// 2. Main process (src/main/scraper.ts)
async exportData(data: any[], format: string, onProgress?: (progress: number) => void) {
  const total = data.length;

  for (let i = 0; i < data.length; i++) {
    await processRow(data[i]);

    if (onProgress) {
      onProgress((i + 1) / total * 100);
    }
  }
}

// 3. IPC Handler (src/main/main.ts)
ipcMain.handle('export-with-progress', async (event, data, format) => {
  await scraper.exportData(data, format, (progress) => {
    event.sender.send('export-progress', progress);
  });
});

// 4. Preload (src/preload/preload.ts)
contextBridge.exposeInMainWorld('api', {
  exportWithProgress: (data: any[], format: string) =>
    ipcRenderer.invoke('export-with-progress', data, format),

  onExportProgress: (callback: (progress: number) => void) =>
    ipcRenderer.on('export-progress', (_, progress) => callback(progress))
});

// 5. React Component (src/renderer/App.tsx)
const [exportProgress, setExportProgress] = useState<ExportProgress>({
  current: 0,
  total: 100,
  status: 'idle'
});

useEffect(() => {
  window.api.onExportProgress((progress) => {
    setExportProgress(prev => ({
      ...prev,
      current: progress,
      status: 'exporting'
    }));
  });
}, []);

const handleExport = async () => {
  try {
    setExportProgress({ current: 0, total: 100, status: 'exporting' });
    await window.api.exportWithProgress(data, 'json');
    setExportProgress({ current: 100, total: 100, status: 'complete' });
  } catch (error) {
    setExportProgress(prev => ({ ...prev, status: 'error' }));
  }
};

// 6. JSX
{exportProgress.status === 'exporting' && (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
      style={{ width: `${exportProgress.current}%` }}
    />
  </div>
)}
```

</details>

## Checklist

Before submitting your feature:

- [ ] Code follows existing patterns
- [ ] Types are properly defined
- [ ] Error handling is implemented
- [ ] User feedback is provided (toasts, modals)
- [ ] Security considerations addressed
- [ ] Feature tested manually
- [ ] Documentation updated
- [ ] Commit message follows conventions
- [ ] No console.log statements left behind
- [ ] Code is formatted (use Prettier)

## Next Steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) for system overview
- Read [SECURITY.md](SECURITY.md) for security guidelines
- Read [DEVELOPMENT.md](DEVELOPMENT.md) for dev environment setup

---

**Questions?** Open a [GitHub Discussion](https://github.com/browse4extract/browse4extract/discussions) or [issue](https://github.com/browse4extract/browse4extract/issues).
