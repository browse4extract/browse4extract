// Types for data extraction
export type ExtractorType = 'text' | 'attribute' | 'child-link-url' | 'child-link-text';

export type ExportFormat = 'json' | 'csv' | 'excel';

export interface DataExtractor {
  id: string;
  fieldName: string;
  selector: string;
  extractorType: ExtractorType;
  attributeName?: string; // Pour le type 'attribute'
}

export interface ScrapingConfig {
  url: string;
  fileName: string;
  extractors: DataExtractor[];
  debugMode: boolean;
  exportFormat?: ExportFormat;
  // Obstacle handling options
  handleObstacles?: boolean; // Auto-handle cookies, popups, ads (default: true)
  blockAds?: boolean; // Block ads and trackers (default: true)
  useStealthMode?: boolean; // Use stealth mode to avoid detection (default: true)
}

export interface ScrapingTemplate {
  id: string;
  name: string;
  description?: string;
  url: string;
  extractors: DataExtractor[];
  createdAt: string;
  updatedAt: string;
}

export interface ScrapedData {
  [key: string]: string | null;
}

export interface LogMessage {
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export interface ScrapingProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  currentItem?: number;
  totalItems?: number;
  data: ScrapedData[];
  logs: LogMessage[];
  error?: string;
}

// Types for Electron API exposed via preload
export interface ElectronAPI {
  startScraping: (config: ScrapingConfig) => Promise<void>;
  previewSelector: (url: string, selector: string, extractorType: ExtractorType, attributeName?: string) => Promise<any>;
  pickElement: (url: string) => Promise<any>;
  onScrapingProgress: (callback: (progress: ScrapingProgress) => void) => (() => void);
  onLog: (callback: (log: LogMessage) => void) => (() => void);
  onDataExtracted: (callback: (data: ScrapedData) => void) => (() => void);
  onScrapingComplete: (callback: (result: any) => void) => (() => void);
  onScrapingError: (callback: (error: any) => void) => (() => void);
  // Profile management
  saveProfile: (profileData: any) => Promise<any>;
  loadProfile: () => Promise<any>;
  getStartupProfile: () => Promise<any>;
  onProfileLoaded: (callback: (result: any) => void) => (() => void);
  // Settings & folder management
  getConfig: () => Promise<any>;
  updateConfig: (newConfig: any) => Promise<any>;
  selectFolder: (title: string, defaultPath?: string) => Promise<any>;
  getOutputsPath: () => Promise<string>;
  openOutputsFolder: () => Promise<any>;
  openSavesFolder: () => Promise<any>;
  // Unsaved changes management
  setUnsavedChanges: (unsaved: boolean) => Promise<any>;
  saveCompletedClose: () => Promise<any>;
  onSaveBeforeClose: (callback: () => void) => (() => void);
  // Window controls
  windowMinimize: () => Promise<any>;
  windowMaximize: () => Promise<any>;
  windowClose: () => Promise<any>;
  windowIsMaximized: () => Promise<any>;
  forceClose: () => Promise<any>;
  onShowCloseConfirmation: (callback: () => void) => (() => void);
}

// Extension du Window pour TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
