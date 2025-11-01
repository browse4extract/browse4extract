import { contextBridge, ipcRenderer } from 'electron';
import { ScrapingConfig, LogMessage, ScrapedData, ExtractorType } from '../types/types';

// Expose Electron API securely via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  startScraping: async (config: ScrapingConfig): Promise<any> => {
    return await ipcRenderer.invoke('start-scraping', config);
  },

  previewSelector: async (url: string, selector: string, extractorType: ExtractorType, attributeName?: string): Promise<any> => {
    return await ipcRenderer.invoke('preview-selector', url, selector, extractorType, attributeName);
  },

  pickElement: async (url: string): Promise<any> => {
    return await ipcRenderer.invoke('pick-element', url);
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
  }
});
