import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Scraper } from './scraper';
import { ConfigManager } from './configManager';
import { DiscordRpcService } from './discordRpc';
import { ScrapingConfig, LogMessage, ScrapedData, ExtractorType } from '../types/types';

let mainWindow: BrowserWindow | null = null;
let scraper: Scraper | null = null;
let configManager: ConfigManager | null = null;
let discordRpc: DiscordRpcService | null = null;
let hasUnsavedChanges: boolean = false;

// Get icon path
function getIconPath(): string {
  const iconFile = process.platform === 'win32' ? 'app_image.ico' : 'app_image.png';
  if (process.env.NODE_ENV === 'development') {
    return path.join(__dirname, '../../assets', iconFile);
  }
  return path.join(process.resourcesPath, 'assets', iconFile);
}


function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,  // Remove native window frame
    titleBarStyle: 'hidden',  // macOS specific
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    title: 'Browse4Extract - Web Data Extractor',
    backgroundColor: '#000000',
    icon: getIconPath()
  });

  // In development, load from webpack server
  // In production, load static HTML file
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle window close event (before closing)
  mainWindow.on('close', async (e) => {
    if (hasUnsavedChanges && mainWindow) {
      // Prevent default close
      e.preventDefault();

      // Send event to renderer to show custom modal
      mainWindow.webContents.send('show-close-confirmation');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize config manager
  configManager = new ConfigManager();

  // Initialize Discord Rich Presence (only if enabled)
  if (configManager.isDiscordRPCEnabled()) {
    discordRpc = new DiscordRpcService();
    await discordRpc.initialize();
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle scraping via IPC
ipcMain.handle('start-scraping', async (_event, config: ScrapingConfig) => {
  if (!mainWindow) {
    throw new Error('Main window not initialized');
  }

  try {
    // Create callback to send real-time logs
    const logCallback = (log: LogMessage) => {
      mainWindow?.webContents.send('scraping-log', log);
    };

    // Create callback to send extracted data in real-time
    const dataCallback = (data: ScrapedData) => {
      mainWindow?.webContents.send('data-extracted', data);
    };

    scraper = new Scraper(logCallback, dataCallback, discordRpc || undefined);

    // Generate default filename if needed
    let fileName = config.fileName.trim();
    if (!fileName) {
      const url = new URL(config.url);
      const domain = url.hostname.replace(/^www\./, '');
      const timestamp = Date.now();
      fileName = `${domain}-${timestamp}.json`;
    }

    // Ensure filename has proper extension
    if (!fileName.endsWith('.json')) {
      fileName += '.json';
    }

    const finalConfig = { ...config, fileName };

    // Start scraping
    const results = await scraper.scrape(finalConfig);

    mainWindow.webContents.send('scraping-complete', {
      success: true,
      itemCount: results.length,
      fileName
    });

    return {
      success: true,
      data: results,
      fileName
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    mainWindow?.webContents.send('scraping-error', {
      error: errorMessage
    });

    // Update Discord RPC on error
    if (discordRpc) {
      discordRpc.setError(errorMessage);
    }

    return {
      success: false,
      error: errorMessage
    };
  } finally {
    if (scraper) {
      await scraper.close();
      scraper = null;
    }
  }
});

// Handler for selector preview
ipcMain.handle('preview-selector', async (_event, url: string, selector: string, extractorType: ExtractorType, attributeName?: string) => {
  try {
    scraper = new Scraper();
    const result = await scraper.previewSelector(url, selector, extractorType, attributeName);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Handler pour le Visual Element Picker
ipcMain.handle('pick-element', async (_event, url: string) => {
  try {
    scraper = new Scraper();
    const result = await scraper.pickElement(url);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Profile management (.b4e files)
ipcMain.handle('save-profile', async (_event, profileData: any) => {
  try {
    if (!configManager) {
      throw new Error('Config manager not initialized');
    }

    const savesPath = configManager.getSavesPath();
    const defaultFileName = `profile_${Date.now()}.b4e`;
    const defaultPath = path.join(savesPath, defaultFileName);

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save Scraping Profile',
      defaultPath: defaultPath,
      filters: [
        { name: 'Browse4Extract Profile', extensions: ['b4e'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const dataToSave = JSON.stringify(profileData, null, 2);
      fs.writeFileSync(result.filePath, dataToSave, 'utf-8');
      return { success: true, path: result.filePath };
    }

    return { success: false, canceled: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

ipcMain.handle('load-profile', async () => {
  try {
    if (!configManager) {
      throw new Error('Config manager not initialized');
    }

    const savesPath = configManager.getSavesPath();

    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open Scraping Profile',
      defaultPath: savesPath,
      filters: [
        { name: 'Browse4Extract Profile', extensions: ['b4e'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const profileData = JSON.parse(fileContent);
      return { success: true, data: profileData, path: filePath };
    }

    return { success: false, canceled: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Settings & folder management
ipcMain.handle('get-config', async () => {
  if (!configManager) {
    throw new Error('Config manager not initialized');
  }
  return configManager.getConfig();
});

ipcMain.handle('update-config', async (_event, newConfig: any) => {
  if (!configManager) {
    throw new Error('Config manager not initialized');
  }

  // Check if Discord RPC setting changed
  const oldEnabled = configManager.isDiscordRPCEnabled();
  configManager.updateConfig(newConfig);
  const newEnabled = configManager.isDiscordRPCEnabled();

  // Handle Discord RPC state change
  if (oldEnabled !== newEnabled) {
    if (newEnabled && !discordRpc) {
      // Enable Discord RPC
      discordRpc = new DiscordRpcService();
      await discordRpc.initialize();
    } else if (!newEnabled && discordRpc) {
      // Disable Discord RPC
      await discordRpc.destroy();
      discordRpc = null;
    }
  }

  return { success: true };
});

ipcMain.handle('select-folder', async (_event, title: string, defaultPath?: string) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: title,
      defaultPath: defaultPath,
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }

    return { success: false, canceled: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Outputs folder management
ipcMain.handle('get-outputs-path', async () => {
  if (!configManager) {
    throw new Error('Config manager not initialized');
  }
  return configManager.getOutputsPath();
});

ipcMain.handle('open-outputs-folder', async () => {
  try {
    if (!configManager) {
      throw new Error('Config manager not initialized');
    }
    await shell.openPath(configManager.getOutputsPath());
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

ipcMain.handle('open-saves-folder', async () => {
  try {
    if (!configManager) {
      throw new Error('Config manager not initialized');
    }
    await shell.openPath(configManager.getSavesPath());
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Handle unsaved changes notification from renderer
ipcMain.handle('set-unsaved-changes', async (_event, unsaved: boolean) => {
  hasUnsavedChanges = unsaved;
  return { success: true };
});

// Handle save completed after close request
ipcMain.handle('save-completed-close', async () => {
  hasUnsavedChanges = false;
  if (mainWindow) {
    mainWindow.destroy();
  }
  return { success: true };
});

// Window controls for custom title bar
ipcMain.handle('window-minimize', async () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
  return { success: true };
});

ipcMain.handle('window-maximize', async () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
  return { success: true };
});

ipcMain.handle('window-close', async () => {
  if (mainWindow) {
    mainWindow.close();
  }
  return { success: true };
});

ipcMain.handle('window-is-maximized', async () => {
  if (mainWindow) {
    return { maximized: mainWindow.isMaximized() };
  }
  return { maximized: false };
});

// Force close without unsaved changes check
ipcMain.handle('force-close', async () => {
  hasUnsavedChanges = false;
  if (mainWindow) {
    mainWindow.destroy();
  }
  return { success: true };
});

// Handle opening .b4e files (file association)
let fileToOpen: string | null = null;

if (process.platform === 'win32' && process.argv.length >= 2) {
  // On Windows, file path is in process.argv
  const filePath = process.argv.find(arg => arg.endsWith('.b4e'));
  if (filePath && fs.existsSync(filePath)) {
    fileToOpen = filePath;
  }
}

app.on('open-file', (event, filePath) => {
  // macOS file association
  event.preventDefault();
  if (filePath.endsWith('.b4e')) {
    fileToOpen = filePath;
    if (mainWindow) {
      loadProfileFromFile(filePath);
    }
  }
});

ipcMain.handle('get-startup-profile', async () => {
  if (fileToOpen) {
    try {
      const fileContent = fs.readFileSync(fileToOpen, 'utf-8');
      const profileData = JSON.parse(fileContent);
      const temp = fileToOpen;
      fileToOpen = null; // Clear after reading
      return { success: true, data: profileData, path: temp };
    } catch (error) {
      fileToOpen = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  return { success: false, noFile: true };
});

function loadProfileFromFile(filePath: string) {
  if (mainWindow) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const profileData = JSON.parse(fileContent);
      mainWindow.webContents.send('profile-loaded', { success: true, data: profileData, path: filePath });
    } catch (error) {
      mainWindow.webContents.send('profile-loaded', {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Handle clean shutdown
app.on('before-quit', async () => {
  if (scraper) {
    await scraper.close();
  }
  if (discordRpc) {
    await discordRpc.destroy();
  }
});
