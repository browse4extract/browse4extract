import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { Scraper } from './scraper';
import { ConfigManager } from './configManager';
import { DiscordRpcService } from './discordRpc';
import { SessionManager } from './sessionManager';
import { UpdateChecker } from './updateChecker';
import { UpdateLauncherWindow, getErrorMessage } from './updateLauncher';
import { ScrapingConfig, LogMessage, ScrapedData, ExtractorType, AdvancedLogMessage, SessionProfile, SessionCreationResult } from '../types/types';
import { logger } from './Logger';

let mainWindow: BrowserWindow | null = null;
let debugWindow: BrowserWindow | null = null;
let scraper: Scraper | null = null;
let configManager: ConfigManager | null = null;
let discordRpc: DiscordRpcService | null = null;
let sessionManager: SessionManager | null = null;
let updateLauncher: UpdateLauncherWindow | null = null;
let hasUnsavedChanges: boolean = false;

// SECURITY: Rate limiting for IPC operations
const ipcOperationTimes = new Map<string, number[]>();
const RATE_LIMIT_CONFIG = {
  // Scraping operations (intensive)
  'start-scraping': { windowMs: 10000, maxRequests: 1 },  // 1 request per 10s
  'pick-element': { windowMs: 5000, maxRequests: 3 },     // 3 requests per 5s
  'preview-selector': { windowMs: 3000, maxRequests: 5 }, // 5 requests per 3s

  // Session operations (sensitive)
  'create-session': { windowMs: 5000, maxRequests: 2 },   // 2 requests per 5s
  'save-current-session': { windowMs: 5000, maxRequests: 2 },
  'delete-session': { windowMs: 2000, maxRequests: 3 },
  'test-session': { windowMs: 3000, maxRequests: 5 },

  // File operations (I/O intensive)
  'save-profile': { windowMs: 2000, maxRequests: 5 },     // 5 requests per 2s
  'load-profile': { windowMs: 1000, maxRequests: 10 },

  // Config operations
  'update-config': { windowMs: 1000, maxRequests: 10 },
  'update-debug-settings': { windowMs: 1000, maxRequests: 10 },

  // Default for unlisted operations
  'default': { windowMs: 1000, maxRequests: 30 }          // 30 requests per second
};

/**
 * Check if an IPC operation is rate limited
 * Uses sliding window algorithm
 * @param operation - IPC channel name
 * @returns true if allowed, false if rate limited
 */
function checkRateLimit(operation: string): boolean {
  const now = Date.now();
  const config = RATE_LIMIT_CONFIG[operation as keyof typeof RATE_LIMIT_CONFIG] || RATE_LIMIT_CONFIG.default;

  // Get or create timestamp array for this operation
  if (!ipcOperationTimes.has(operation)) {
    ipcOperationTimes.set(operation, []);
  }

  const timestamps = ipcOperationTimes.get(operation)!;

  // Remove timestamps outside the window
  const windowStart = now - config.windowMs;
  const validTimestamps = timestamps.filter(time => time > windowStart);

  // Check if under limit
  if (validTimestamps.length >= config.maxRequests) {
    logger.log('Browse4Extract', 'warning', `Rate limit exceeded for operation: ${operation}`);
    return false;
  }

  // Add current timestamp and update
  validTimestamps.push(now);
  ipcOperationTimes.set(operation, validTimestamps);

  // Cleanup old entries periodically (every 100 calls)
  if (Math.random() < 0.01) {
    cleanupRateLimitCache();
  }

  return true;
}

/**
 * Cleanup rate limit cache to prevent memory leaks
 */
function cleanupRateLimitCache(): void {
  const now = Date.now();
  const maxAge = 60000; // 1 minute

  for (const [operation, timestamps] of ipcOperationTimes.entries()) {
    const validTimestamps = timestamps.filter(time => now - time < maxAge);
    if (validTimestamps.length === 0) {
      ipcOperationTimes.delete(operation);
    } else {
      ipcOperationTimes.set(operation, validTimestamps);
    }
  }
}

// Set custom userData path for SieApps organization
const customUserDataPath = path.join(
  app.getPath('appData'),
  'SieApps',
  'Browse4Extract'
);
app.setPath('userData', customUserDataPath);

// SECURITY: Register custom protocol scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'b4e',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: false
    }
  }
]);

// Get icon path
function getIconPath(): string {
  const iconFile = process.platform === 'win32' ? 'app_image.ico' : 'app_image.png';
  if (process.env.NODE_ENV === 'development') {
    return path.join(__dirname, '../../assets', iconFile);
  }
  return path.join(process.resourcesPath, 'assets', iconFile);
}


/**
 * Handle the update check and installation process
 * @returns true if the application should continue, false if it restarts for update
 */
async function handleUpdateProcess(): Promise<boolean> {
  logger.info('electron', '[Update] Starting update process...');

  // Create the launcher window
  updateLauncher = new UpdateLauncherWindow();
  updateLauncher.createWindow();

  const currentVersion = app.getVersion();
  logger.info('electron', `[Update] Current version: ${currentVersion}`);
  updateLauncher.setChecking(currentVersion);

  // Create the update checker
  const updateChecker = new UpdateChecker({
    versionUrl: 'https://browse4extract.github.io/browse4extract/version.json',
    timeout: 10000,
    autoDownload: true,
  });

  try {
    // Check for updates
    logger.info('electron', '[Update] Checking for updates...');
    const checkResult = await updateChecker.checkForUpdates();

    if (checkResult.error) {
      // Error encountered (no internet connection, etc.)
      logger.warning('electron', `[Update] Error checking for updates: ${checkResult.error}`);
      const errorMessage = getErrorMessage(checkResult.error);
      updateLauncher.setError(currentVersion, checkResult.error, errorMessage);

      // Wait for user choice (retry or launch anyway)
      return new Promise((resolve) => {
        // The user will click on one of the buttons
        // which will trigger the IPC handlers below
        const retryHandler = async () => {
          ipcMain.removeListener('update-launcher:retry', retryHandler);
          ipcMain.removeListener('update-launcher:launch-anyway', launchHandler);

          // Retry checking
          updateLauncher?.close();
          const shouldContinue = await handleUpdateProcess();
          resolve(shouldContinue);
        };

        const launchHandler = async () => {
          ipcMain.removeListener('update-launcher:retry', retryHandler);
          ipcMain.removeListener('update-launcher:launch-anyway', launchHandler);

          // Launch app anyway
          updateLauncher?.close();
          // Wait for update window to fully close before continuing
          await new Promise((r) => setTimeout(r, 300));
          resolve(true);
        };

        ipcMain.once('update-launcher:retry', retryHandler);
        ipcMain.once('update-launcher:launch-anyway', launchHandler);
      });
    }

    if (!checkResult.available || !checkResult.remoteVersion) {
      // No update available, continue
      logger.info('electron', '[Update] No update available, launching app...');
      updateLauncher.setReady(currentVersion);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Briefly display "Up to date"
      updateLauncher.close();
      // Wait for update window to fully close before continuing
      await new Promise((resolve) => setTimeout(resolve, 300));
      logger.info('electron', '[Update] Update window closed, returning true to launch main window');
      return true;
    }

    // Update available
    updateLauncher.setUpdateAvailable(currentVersion, checkResult.remoteVersion);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Let user see the changelog

    // Download and install
    updateLauncher.setDownloading(
      currentVersion,
      checkResult.remoteVersion.version,
      { percent: 0, transferred: 0, total: 0, speed: 0 }
    );

    const installResult = await updateChecker.downloadAndInstall(
      checkResult.remoteVersion,
      (progress) => {
        if (updateLauncher) {
          updateLauncher.setDownloading(
            currentVersion,
            checkResult.remoteVersion!.version,
            progress
          );
        }
      }
    );

    if (installResult.requiresRestart) {
      // Windows/Linux: Automatic installation, app will restart
      updateLauncher.setInstalling(currentVersion, checkResult.remoteVersion.version);
      // The application will restart via app.relaunch() in updateChecker
      return false;
    } else {
      // macOS: Manual installation required, launch app
      updateLauncher.setReady(currentVersion);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      updateLauncher.close();
      // Wait for update window to fully close before continuing
      await new Promise((resolve) => setTimeout(resolve, 300));
      logger.info('electron', '[Update] DMG opened for manual installation. Launching app...');
      return true;
    }
  } catch (error) {
    logger.error('electron', `[Update] Error during update process: ${error}`);

    // In case of error, display message and allow launch
    updateLauncher.setError(
      currentVersion,
      'FETCH_FAILED',
      'An error occurred during the update. You can launch the application anyway.'
    );

    return new Promise((resolve) => {
      const retryHandler = async () => {
        ipcMain.removeListener('update-launcher:retry', retryHandler);
        ipcMain.removeListener('update-launcher:launch-anyway', launchHandler);

        updateLauncher?.close();
        const shouldContinue = await handleUpdateProcess();
        resolve(shouldContinue);
      };

      const launchHandler = async () => {
        ipcMain.removeListener('update-launcher:retry', retryHandler);
        ipcMain.removeListener('update-launcher:launch-anyway', launchHandler);

        updateLauncher?.close();
        // Wait for update window to fully close before continuing
        await new Promise((r) => setTimeout(r, 300));
        resolve(true);
      };

      ipcMain.once('update-launcher:retry', retryHandler);
      ipcMain.once('update-launcher:launch-anyway', launchHandler);
    });
  }
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
      sandbox: true,  // SECURITY: Enable renderer process sandboxing
      preload: path.join(__dirname, '../preload/preload.js')
    },
    title: 'Browse4Extract - Web Data Extractor',
    backgroundColor: '#000000',
    icon: getIconPath()
  });

  // In development, load from webpack server
  // In production, load via custom b4e:// protocol
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('b4e://./index.html');
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
    // Close debug window when main window closes
    if (debugWindow && !debugWindow.isDestroyed()) {
      debugWindow.close();
    }
  });
}

app.whenReady().then(async () => {
  // SECURITY: Set Content Security Policy at session level
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: b4e:; " +
          "font-src 'self' data:; " +
          "connect-src 'none'; " +
          "object-src 'none'; " +
          "base-uri 'self'; " +
          "form-action 'none'; " +
          "frame-ancestors 'none';"
        ]
      }
    });
  });

  // SECURITY: Register custom protocol handler for serving app files
  protocol.handle('b4e', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);

    // Remove leading slash for Windows compatibility
    if (pathname.startsWith('/')) {
      pathname = pathname.substring(1);
    }

    // Determine base directory (dist/renderer in production)
    const baseDir = path.join(__dirname, '../renderer');

    // Resolve the full path
    const filePath = path.resolve(baseDir, pathname);

    // SECURITY: Prevent directory traversal attacks
    const relativePath = path.relative(baseDir, filePath);
    const isSafe = relativePath &&
                   !relativePath.startsWith('..') &&
                   !path.isAbsolute(relativePath);

    if (!isSafe) {
      logger.error('electron', `[Protocol Handler] Blocked unsafe path access: ${pathname}`);
      return new Response('Forbidden: Path traversal detected', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Serve the file
    try {
      return net.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      logger.error('electron', `[Protocol Handler] Error serving file ${pathname}: ${error instanceof Error ? error.message : String(error)}`);
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  });

  // Initialize config manager
  configManager = new ConfigManager();

  // Initialize logger with current debug settings
  const debugSettings = configManager.getDebugSettings();
  logger.configure({
    debugEnabled: debugSettings.enabled,
    advancedLogsEnabled: debugSettings.advancedLogs,
    originalConsole: originalMainConsole
  });

  // Initialize Discord Rich Presence (only if enabled)
  if (configManager.isDiscordRPCEnabled()) {
    discordRpc = new DiscordRpcService();
    await discordRpc.initialize();
  }

  // Initialize Session Manager
  sessionManager = new SessionManager();

  // Handle the update process before launching the application
  const shouldContinue = await handleUpdateProcess();

  if (shouldContinue) {
    // No update or user chose to launch anyway
    createWindow();

    // Open debug window if enabled
    if (debugSettings.advancedLogs) {
      createDebugWindow();
    }
  } else {
    // The application will restart to apply the update
    // We do nothing more
    logger.info('electron', '[Update] Application will restart to apply update');
  }

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

// SECURITY: IPC Message Size Validation Helper
// Prevents DoS attacks via massive IPC messages causing memory exhaustion
function validateIpcMessageSize(data: any, maxSizeBytes: number = 1024 * 1024): void {
  const dataSize = Buffer.byteLength(JSON.stringify(data));
  if (dataSize > maxSizeBytes) {
    throw new Error(`IPC message too large: ${dataSize} bytes (max: ${maxSizeBytes} bytes)`);
  }
}

// Handle scraping via IPC
ipcMain.handle('start-scraping', async (_event, config: ScrapingConfig) => {
  if (!mainWindow) {
    throw new Error('Main window not initialized');
  }

  try {
    // SECURITY: Rate limiting (prevent abuse)
    if (!checkRateLimit('start-scraping')) {
      throw new Error('Too many scraping requests. Please wait before starting another scrape.');
    }

    // SECURITY: Validate IPC message size (prevent DoS)
    validateIpcMessageSize(config);

    // Create callback to send real-time logs
    const logCallback = (log: LogMessage) => {
      mainWindow?.webContents.send('scraping-log', log);
    };

    // Create callback to send extracted data in real-time
    const dataCallback = (data: ScrapedData) => {
      mainWindow?.webContents.send('data-extracted', data);
    };

    scraper = new Scraper(logCallback, dataCallback, discordRpc || undefined, sessionManager || undefined);

    // Generate default filename if needed
    let fileName = config.fileName.trim();
    const format = config.exportFormat || 'json';
    const extension = format === 'excel' ? '.xlsx' : format === 'csv' ? '.csv' : '.json';

    if (!fileName) {
      const url = new URL(config.url);
      const domain = url.hostname.replace(/^www\./, '');
      const timestamp = Date.now();
      fileName = `${domain}-${timestamp}${extension}`;
    }

    // Ensure filename has proper extension for the selected format
    if (!fileName.endsWith(extension)) {
      // Remove any existing extension
      fileName = fileName.replace(/\.(json|csv|xlsx)$/i, '');
      fileName += extension;
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
    scraper = new Scraper(undefined, undefined, undefined, sessionManager || undefined);
    const result = await scraper.previewSelector(url, selector, extractorType, attributeName);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Handler for the Visual Element Picker
ipcMain.handle('pick-element', async (_event, url: string, sessionProfileId?: string) => {
  try {
    // SECURITY: Rate limiting (prevent abuse)
    if (!checkRateLimit('pick-element')) {
      throw new Error('Too many element picker requests. Please wait a moment.');
    }

    scraper = new Scraper(undefined, undefined, undefined, sessionManager || undefined);
    const result = await scraper.pickElement(url, sessionProfileId);
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

    // SECURITY: Validate IPC message size (prevent DoS)
    validateIpcMessageSize(profileData);

    // SECURITY: Validate profile data before saving
    if (!validateProfileData(profileData)) {
      throw new Error('Invalid profile data structure');
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
      // SECURITY: Normalize the file path
      const normalizedPath = path.normalize(path.resolve(result.filePath));

      // SECURITY: Ensure file has .b4e extension
      if (!normalizedPath.endsWith('.b4e')) {
        throw new Error('Profile must have .b4e extension');
      }

      const dataToSave = JSON.stringify(profileData, null, 2);

      // SECURITY: Check data size before writing (max 10MB)
      if (Buffer.byteLength(dataToSave, 'utf-8') > 10 * 1024 * 1024) {
        throw new Error('Profile data too large (max 10MB)');
      }

      fs.writeFileSync(normalizedPath, dataToSave, 'utf-8');
      return { success: true, path: normalizedPath };
    }

    return { success: false, canceled: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// SECURITY: Validate profile data structure
function validateProfileData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Allowed fields in profile
  const allowedFields = ['url', 'fileName', 'debugMode', 'exportFormat', 'extractors'];

  // Remove unknown fields
  for (const key of Object.keys(data)) {
    if (!allowedFields.includes(key)) {
      delete data[key];
    }
  }

  // Validate url if present
  if (data.url !== undefined) {
    if (typeof data.url !== 'string' || data.url.length > 2000) {
      return false;
    }
  }

  // Validate fileName if present
  if (data.fileName !== undefined) {
    if (typeof data.fileName !== 'string' || data.fileName.length > 255) {
      return false;
    }
  }

  // Validate debugMode if present
  if (data.debugMode !== undefined && typeof data.debugMode !== 'boolean') {
    return false;
  }

  // Validate exportFormat if present
  if (data.exportFormat !== undefined) {
    if (!['json', 'csv', 'excel'].includes(data.exportFormat)) {
      return false;
    }
  }

  // Validate extractors if present
  if (data.extractors !== undefined) {
    if (!Array.isArray(data.extractors)) {
      return false;
    }

    // Validate each extractor
    for (const extractor of data.extractors) {
      if (!extractor || typeof extractor !== 'object') {
        return false;
      }

      // Check required fields
      if (!extractor.id || !extractor.fieldName || !extractor.selector || !extractor.extractorType) {
        return false;
      }

      // Validate types
      if (typeof extractor.fieldName !== 'string' || extractor.fieldName.length > 100) {
        return false;
      }

      if (typeof extractor.selector !== 'string' || extractor.selector.length > 500) {
        return false;
      }

      if (!['text', 'attribute', 'child-link-url', 'child-link-text'].includes(extractor.extractorType)) {
        return false;
      }
    }
  }

  return true;
}

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

      // SECURITY: Validate file extension (prevent loading executable files)
      const normalizedPath = path.normalize(path.resolve(filePath));
      const ext = path.extname(normalizedPath).toLowerCase();
      const dangerousExtensions = ['.exe', '.dll', '.bat', '.cmd', '.vbs', '.js', '.msi', '.scr', '.com'];

      if (dangerousExtensions.includes(ext)) {
        throw new Error('Cannot load files with potentially dangerous extensions');
      }

      // SECURITY: Check file size (max 10MB)
      const stats = fs.statSync(filePath);
      if (stats.size > 10 * 1024 * 1024) {
        throw new Error('Profile file too large (max 10MB)');
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // SECURITY: Validate JSON before parsing
      let profileData;
      try {
        profileData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid JSON format in profile file');
      }

      // SECURITY: Validate profile structure
      if (!validateProfileData(profileData)) {
        throw new Error('Invalid or corrupted profile data');
      }

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
    // SECURITY: Sanitize and validate defaultPath
    let safePath = defaultPath;
    if (safePath) {
      // Normalize path to prevent traversal attacks
      safePath = path.normalize(path.resolve(safePath));

      // Verify path exists before using it
      if (!fs.existsSync(safePath)) {
        safePath = undefined;
      }
    }

    // SECURITY: Sanitize title to prevent injection
    const safeTitle = String(title).substring(0, 200);

    const result = await dialog.showOpenDialog(mainWindow!, {
      title: safeTitle,
      defaultPath: safePath,
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      // Normalize the selected path
      const selectedPath = path.normalize(path.resolve(result.filePaths[0]));
      return { success: true, path: selectedPath };
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
ipcMain.handle('window-minimize', async (event) => {
  // Get the window that sent this IPC message
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.minimize();
  }
  return { success: true };
});

ipcMain.handle('window-maximize', async (event) => {
  // Get the window that sent this IPC message
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  }
  return { success: true };
});

ipcMain.handle('window-close', async (event) => {
  // Get the window that sent this IPC message
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
  return { success: true };
});

ipcMain.handle('window-is-maximized', async (event) => {
  // Get the window that sent this IPC message
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    return { maximized: window.isMaximized() };
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

// Open external URLs
ipcMain.handle('open-external', async (_event, url: string) => {
  try {
    // SECURITY: Validate URL to prevent malicious protocols
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL format');
    }

    // Parse and validate URL
    const urlObj = new URL(url);

    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS protocols are allowed');
    }

    // Additional safety check: ensure URL is properly formed
    if (!urlObj.hostname) {
      throw new Error('Invalid URL: missing hostname');
    }

    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
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
      // SECURITY: Check file size (max 10MB)
      const stats = fs.statSync(fileToOpen);
      if (stats.size > 10 * 1024 * 1024) {
        throw new Error('Profile file too large (max 10MB)');
      }

      const fileContent = fs.readFileSync(fileToOpen, 'utf-8');

      // SECURITY: Validate JSON before parsing
      let profileData;
      try {
        profileData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid JSON format in profile file');
      }

      // SECURITY: Validate profile structure
      if (!validateProfileData(profileData)) {
        throw new Error('Invalid or corrupted profile data');
      }

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
      // SECURITY: Check file size (max 10MB)
      const stats = fs.statSync(filePath);
      if (stats.size > 10 * 1024 * 1024) {
        throw new Error('Profile file too large (max 10MB)');
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // SECURITY: Validate JSON before parsing
      let profileData;
      try {
        profileData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid JSON format in profile file');
      }

      // SECURITY: Validate profile structure
      if (!validateProfileData(profileData)) {
        throw new Error('Invalid or corrupted profile data');
      }

      mainWindow.webContents.send('profile-loaded', { success: true, data: profileData, path: filePath });
    } catch (error) {
      mainWindow.webContents.send('profile-loaded', {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// SECURITY: Patch global console to intercept all main process logs
// Export for Logger to prevent infinite recursion
export const originalMainConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

console.log = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  logger.nodejs('info', message);
  // Logs only appear in Debug Tools, not in DevTools
};

console.error = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  logger.nodejs('error', message);
  // Critical errors still need original console for system debugging
  originalMainConsole.error(...args);
};

console.warn = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  logger.nodejs('warning', message);
  // Logs only appear in Debug Tools
};

console.info = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  logger.nodejs('info', message);
  // Logs only appear in Debug Tools
};

console.debug = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  logger.nodejs('debug', message);
  // Logs only appear in Debug Tools
};

// Intercept renderer console logs
ipcMain.on('renderer-console-log', (_event, level: string, args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');

  const logLevel = level === 'log' ? 'info' : level as any;
  logger.log('electron', logLevel, `[Renderer] ${message}`);
});

// Advanced logging IPC handlers
ipcMain.handle('get-debug-settings', async () => {
  if (!configManager) {
    throw new Error('Config manager not initialized');
  }
  return configManager.getDebugSettings();
});

ipcMain.handle('update-debug-settings', async (_event, settings) => {
  if (!configManager) {
    throw new Error('Config manager not initialized');
  }

  const oldSettings = configManager.getDebugSettings();
  configManager.updateDebugSettings(settings);

  // Configure logger with new settings
  logger.configure({
    debugEnabled: settings.enabled,
    advancedLogsEnabled: settings.advancedLogs,
    originalConsole: originalMainConsole
  });

  // Handle advanced logs window
  if (settings.advancedLogs && !oldSettings.advancedLogs) {
    // Open debug window
    createDebugWindow();
  } else if (!settings.advancedLogs && oldSettings.advancedLogs) {
    // Close debug window
    if (debugWindow) {
      debugWindow.close();
      debugWindow = null;
    }
  }

  return { success: true };
});

// ============================================================================
// SESSION MANAGEMENT IPC HANDLERS
// ============================================================================

// Create a new session by opening a browser for login
ipcMain.handle('create-session', async (_event, name: string, loginUrl: string): Promise<SessionCreationResult> => {
  try {
    // Rate limiting
    if (!checkRateLimit('create-session')) {
      return { success: false, error: 'Too many requests. Please wait a moment.' };
    }

    if (!sessionManager) {
      return { success: false, error: 'Session manager not initialized' };
    }

    // Validate session name
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Session name is required.' };
    }
    if (name.length > 100) {
      return { success: false, error: 'Session name too long (max 100 characters).' };
    }
    if (name.trim().length < 3) {
      return { success: false, error: 'Session name too short (min 3 characters).' };
    }
    // Remove dangerous characters from session name
    const safeName = name.trim().replace(/[\/\\:*?"<>|]/g, '_');

    // Validate URL to prevent SSRF attacks
    try {
      const urlObj = new URL(loginUrl);

      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { success: false, error: 'Invalid protocol. Only HTTP/HTTPS allowed.' };
      }

      // Block localhost and loopback IPs
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
      if (blockedHosts.includes(urlObj.hostname.toLowerCase())) {
        return { success: false, error: 'Cannot access localhost or internal networks.' };
      }

      // Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
      const ipMatch = urlObj.hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (ipMatch) {
        const [, a, b] = ipMatch.map(Number);
        if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
          return { success: false, error: 'Cannot access private IP ranges.' };
        }
        // Also block link-local (169.254.x.x)
        if (a === 169 && b === 254) {
          return { success: false, error: 'Cannot access link-local addresses.' };
        }
      }
    } catch (error) {
      return { success: false, error: 'Invalid URL format.' };
    }

    logger.info('Browse4Extract', `Creating new session "${safeName}" for URL: ${loginUrl}`);

    // Create a new scraper instance with visible browser
    const tempScraper = new Scraper(undefined, undefined, undefined, sessionManager);
    await tempScraper.initialize(true); // visible browser

    const page = tempScraper.getPage();
    const browser = tempScraper.getBrowser();

    if (!page || !browser) {
      return { success: false, error: 'Failed to initialize browser' };
    }

    // Navigate to login URL
    await page.goto(loginUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Store the scraper reference for session capture
    scraper = tempScraper;
    sessionManager.setActiveBrowserPage(browser, page);

    logger.success('Browse4Extract', `Browser opened for session "${safeName}". User can now log in.`);

    // Return success - browser stays open for user to log in
    return {
      success: true,
      profile: {
        id: `temp_${Date.now()}`,
        name: safeName,
        domain: new URL(loginUrl).hostname,
        loginUrl,
        cookies: [],
        createdAt: new Date().toISOString()
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Browse4Extract', `Failed to create session: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage
    };
  }
});

// Save the current session after user has logged in
ipcMain.handle('save-current-session', async (_event, _sessionId: string, name: string, domain: string, loginUrl?: string): Promise<SessionCreationResult> => {
  try {
    // Rate limiting
    if (!checkRateLimit('save-session')) {
      return { success: false, error: 'Too many requests. Please wait a moment.' };
    }

    if (!sessionManager) {
      return { success: false, error: 'Session manager not initialized' };
    }

    const page = sessionManager.getActivePage();
    if (!page) {
      return { success: false, error: 'No active browser session to capture' };
    }

    logger.info('Browse4Extract', `Capturing session "${name}"...`);

    // Generate final session ID
    const finalSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Capture the session
    const result = await sessionManager.captureSessionFromPage(page, finalSessionId, name, domain, loginUrl);

    // Close the browser
    if (scraper) {
      await scraper.close();
      scraper = null;
    }

    sessionManager.clearActiveBrowser();

    if (result.success) {
      logger.success('Browse4Extract', `Session "${name}" saved successfully`);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Browse4Extract', `Failed to save session: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage
    };
  }
});

// List all saved sessions
ipcMain.handle('list-sessions', async (): Promise<SessionProfile[]> => {
  try {
    if (!sessionManager) {
      logger.warning('Browse4Extract', 'Session manager not initialized');
      return [];
    }

    const sessions = await sessionManager.listSessions();
    logger.info('Browse4Extract', `Found ${sessions.length} saved sessions`);
    return sessions;
  } catch (error) {
    logger.error('Browse4Extract', `Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
});

// Delete a session
ipcMain.handle('delete-session', async (_event, sessionId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Rate limiting
    if (!checkRateLimit('delete-session')) {
      return { success: false, error: 'Too many requests. Please wait a moment.' };
    }

    if (!sessionManager) {
      return { success: false, error: 'Session manager not initialized' };
    }

    logger.info('Browse4Extract', `Deleting session: ${sessionId}`);
    const result = await sessionManager.deleteSession(sessionId);

    if (result.success) {
      logger.success('Browse4Extract', `Session deleted successfully`);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Browse4Extract', `Failed to delete session: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage
    };
  }
});

// Test if a session is still valid
ipcMain.handle('test-session', async (_event, sessionId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!sessionManager) {
      return { success: false, error: 'Session manager not initialized' };
    }

    logger.info('Browse4Extract', `Testing session: ${sessionId}`);
    const result = await sessionManager.testSession(sessionId);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Browse4Extract', `Failed to test session: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage
    };
  }
});

// ============================================================================
// END SESSION MANAGEMENT HANDLERS
// ============================================================================

// Function to create debug logs window
function createDebugWindow(): void {
  if (debugWindow) {
    debugWindow.focus();
    return;
  }

  debugWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false, // Remove native window frame
    titleBarStyle: 'hidden', // macOS specific
    title: 'Browse4Extract - Debug Tools',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    backgroundColor: '#000000',
    icon: getIconPath(),
    minWidth: 800,
    minHeight: 600
  });

  // Load debug window HTML
  if (process.env.NODE_ENV === 'development') {
    debugWindow.loadURL('http://localhost:3000/debug.html');
  } else {
    debugWindow.loadURL('b4e://./debug.html');
  }

  debugWindow.on('closed', () => {
    debugWindow = null;
    // Update settings to reflect window closed
    if (configManager) {
      const settings = configManager.getDebugSettings();
      if (settings.advancedLogs) {
        configManager.updateDebugSettings({ advancedLogs: false });
      }
    }
  });
}

// Setup logger event forwarding
logger.on('advanced-log', (log: AdvancedLogMessage) => {
  // Send to debug window if open
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('advanced-log', log);
  }
});

// Handle clean shutdown
app.on('before-quit', async () => {
  if (scraper) {
    await scraper.close();
  }
  if (discordRpc) {
    await discordRpc.destroy();
  }
  if (debugWindow) {
    debugWindow.close();
  }
  // Cleanup logger
  logger.cleanup();
});
