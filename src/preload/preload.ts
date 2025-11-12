import { contextBridge, ipcRenderer } from 'electron';
import { ScrapingConfig, LogMessage, ScrapedData, ExtractorType, AdvancedLogMessage, DebugSettings, SessionProfile, SessionCreationResult } from '../types/types';

// SECURITY: Intercept renderer console logs and send to main process
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

// Override console methods to forward to main process
// Only suppress DevTools output in production to avoid confusion during development
const isProduction = process.env.NODE_ENV === 'production';

console.log = (...args: any[]) => {
  ipcRenderer.send('renderer-console-log', 'log', args);
  // In development, also show in DevTools
  if (!isProduction) {
    originalConsole.log(...args);
  }
};

console.error = (...args: any[]) => {
  ipcRenderer.send('renderer-console-log', 'error', args);
  // Always show errors in DevTools for debugging
  originalConsole.error(...args);
};

console.warn = (...args: any[]) => {
  ipcRenderer.send('renderer-console-log', 'warn', args);
  // In development, also show in DevTools
  if (!isProduction) {
    originalConsole.warn(...args);
  }
};

console.info = (...args: any[]) => {
  ipcRenderer.send('renderer-console-log', 'info', args);
  // In development, also show in DevTools
  if (!isProduction) {
    originalConsole.info(...args);
  }
};

console.debug = (...args: any[]) => {
  ipcRenderer.send('renderer-console-log', 'debug', args);
  // In development, also show in DevTools
  if (!isProduction) {
    originalConsole.debug(...args);
  }
};

// Expose Electron API securely via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  startScraping: async (config: ScrapingConfig): Promise<any> => {
    return await ipcRenderer.invoke('start-scraping', config);
  },

  previewSelector: async (url: string, selector: string, extractorType: ExtractorType, attributeName?: string): Promise<any> => {
    return await ipcRenderer.invoke('preview-selector', url, selector, extractorType, attributeName);
  },

  pickElement: async (url: string, sessionProfileId?: string): Promise<any> => {
    return await ipcRenderer.invoke('pick-element', url, sessionProfileId);
  },

  onLog: (callback: (log: LogMessage) => void): (() => void) => {
    const listener = (_event: any, log: LogMessage) => callback(log);
    ipcRenderer.on('scraping-log', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('scraping-log', listener);
  },

  onDataExtracted: (callback: (data: ScrapedData) => void): (() => void) => {
    const listener = (_event: any, data: ScrapedData) => callback(data);
    ipcRenderer.on('data-extracted', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('data-extracted', listener);
  },

  onScrapingComplete: (callback: (result: any) => void): (() => void) => {
    const listener = (_event: any, result: any) => callback(result);
    ipcRenderer.on('scraping-complete', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('scraping-complete', listener);
  },

  onScrapingError: (callback: (error: any) => void): (() => void) => {
    const listener = (_event: any, error: any) => callback(error);
    ipcRenderer.on('scraping-error', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('scraping-error', listener);
  },

  // Profile management
  saveProfile: async (profileData: any): Promise<any> => {
    return await ipcRenderer.invoke('save-profile', profileData);
  },

  loadProfile: async (): Promise<any> => {
    return await ipcRenderer.invoke('load-profile');
  },

  getStartupProfile: async (): Promise<any> => {
    return await ipcRenderer.invoke('get-startup-profile');
  },

  onProfileLoaded: (callback: (result: any) => void): (() => void) => {
    const listener = (_event: any, result: any) => callback(result);
    ipcRenderer.on('profile-loaded', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('profile-loaded', listener);
  },

  // Settings & folder management
  getConfig: async (): Promise<any> => {
    return await ipcRenderer.invoke('get-config');
  },

  updateConfig: async (newConfig: any): Promise<any> => {
    return await ipcRenderer.invoke('update-config', newConfig);
  },

  selectFolder: async (title: string, defaultPath?: string): Promise<any> => {
    return await ipcRenderer.invoke('select-folder', title, defaultPath);
  },

  // Outputs folder management
  getOutputsPath: async (): Promise<string> => {
    return await ipcRenderer.invoke('get-outputs-path');
  },

  openOutputsFolder: async (): Promise<any> => {
    return await ipcRenderer.invoke('open-outputs-folder');
  },

  openSavesFolder: async (): Promise<any> => {
    return await ipcRenderer.invoke('open-saves-folder');
  },

  // Unsaved changes management
  setUnsavedChanges: async (unsaved: boolean): Promise<any> => {
    return await ipcRenderer.invoke('set-unsaved-changes', unsaved);
  },

  saveCompletedClose: async (): Promise<any> => {
    return await ipcRenderer.invoke('save-completed-close');
  },

  onSaveBeforeClose: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('save-before-close', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('save-before-close', listener);
  },

  // Window controls
  windowMinimize: async (): Promise<any> => {
    return await ipcRenderer.invoke('window-minimize');
  },

  windowMaximize: async (): Promise<any> => {
    return await ipcRenderer.invoke('window-maximize');
  },

  windowClose: async (): Promise<any> => {
    return await ipcRenderer.invoke('window-close');
  },

  windowIsMaximized: async (): Promise<any> => {
    return await ipcRenderer.invoke('window-is-maximized');
  },

  forceClose: async (): Promise<any> => {
    return await ipcRenderer.invoke('force-close');
  },

  onShowCloseConfirmation: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('show-close-confirmation', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('show-close-confirmation', listener);
  },

  // External links
  openExternal: async (url: string): Promise<any> => {
    return await ipcRenderer.invoke('open-external', url);
  },

  // Advanced logging & debug
  onAdvancedLog: (callback: (log: AdvancedLogMessage) => void): (() => void) => {
    const listener = (_event: any, log: AdvancedLogMessage) => callback(log);
    ipcRenderer.on('advanced-log', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('advanced-log', listener);
  },

  getDebugSettings: async (): Promise<DebugSettings> => {
    return await ipcRenderer.invoke('get-debug-settings');
  },

  updateDebugSettings: async (settings: DebugSettings): Promise<any> => {
    return await ipcRenderer.invoke('update-debug-settings', settings);
  },

  // Session management
  createSession: async (name: string, loginUrl: string): Promise<SessionCreationResult> => {
    return await ipcRenderer.invoke('create-session', name, loginUrl);
  },

  listSessions: async (): Promise<SessionProfile[]> => {
    return await ipcRenderer.invoke('list-sessions');
  },

  deleteSession: async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('delete-session', sessionId);
  },

  testSession: async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('test-session', sessionId);
  },

  saveCurrentSession: async (sessionId: string, name: string, domain: string, loginUrl?: string): Promise<SessionCreationResult> => {
    return await ipcRenderer.invoke('save-current-session', sessionId, name, domain, loginUrl);
  }
});
