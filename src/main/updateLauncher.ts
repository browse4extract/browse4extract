import { BrowserWindow } from 'electron';
import * as path from 'path';
import type {
  UpdateLauncherData,
  DownloadProgress,
  RemoteVersionInfo,
  UpdateError,
} from '../types/update';

/**
 * Update launcher window manager
 */
export class UpdateLauncherWindow {
  private window: BrowserWindow | null = null;

  /**
   * Create and display update window
   */
  createWindow(): BrowserWindow {
    this.window = new BrowserWindow({
      width: 600,
      height: 400,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      center: true,
      show: false, // Don't show immediately
      backgroundColor: '#1a1a1a',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, '../preload/preload.js'),
      },
    });

    // Load launcher interface
    if (process.env.NODE_ENV === 'development') {
      // In development, use webpack server
      this.window.loadURL('http://localhost:4000/update-launcher.html');
    } else {
      // In production, use b4e:// protocol
      this.window.loadURL('b4e://./update-launcher.html');
    }

    // Show window once ready
    this.window.once('ready-to-show', () => {
      this.window?.show();
    });

    // Prevent manual closing during update process
    this.window.on('close', (event) => {
      // Allow closing only if explicitly authorized
      if (!this.canClose) {
        event.preventDefault();
      }
    });

    return this.window;
  }

  /**
   * Send state update to renderer process
   */
  sendState(data: UpdateLauncherData): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('update-launcher:state', data);
    }
  }

  /**
   * Indicates window is checking for updates
   */
  setChecking(currentVersion: string): void {
    this.sendState({
      state: 'checking',
      currentVersion,
    });
  }

  /**
   * Indicates an update is available
   */
  setUpdateAvailable(
    currentVersion: string,
    remoteVersion: RemoteVersionInfo
  ): void {
    this.sendState({
      state: 'update-available',
      currentVersion,
      remoteVersion: remoteVersion.version,
      changelog: remoteVersion.changelog || [],
    });
  }

  /**
   * Indicates download is in progress
   */
  setDownloading(
    currentVersion: string,
    remoteVersion: string,
    progress: DownloadProgress
  ): void {
    this.sendState({
      state: 'downloading',
      currentVersion,
      remoteVersion,
      progress,
    });
  }

  /**
   * Indicates installation is in progress
   */
  setInstalling(currentVersion: string, remoteVersion: string): void {
    this.sendState({
      state: 'installing',
      currentVersion,
      remoteVersion,
    });
  }

  /**
   * Indicates an error occurred
   */
  setError(
    currentVersion: string,
    errorType: UpdateError,
    message: string
  ): void {
    this.sendState({
      state: 'error',
      currentVersion,
      error: {
        type: errorType,
        message,
      },
    });
  }

  /**
   * Indicates application is ready to launch
   */
  setReady(currentVersion: string): void {
    this.sendState({
      state: 'ready',
      currentVersion,
    });
  }

  /**
   * Close update window
   */
  close(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.canClose = true;
      this.window.close();
      this.window = null;
    }
  }

  /**
   * Check if window exists and is not destroyed
   */
  isValid(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }

  /**
   * Get BrowserWindow instance
   */
  getWindow(): BrowserWindow | null {
    return this.window;
  }

  private canClose = false;

  /**
   * Allow window to close
   */
  allowClose(): void {
    this.canClose = true;
  }
}

/**
 * Localized error messages
 */
export function getErrorMessage(errorType: UpdateError): string {
  const messages: Record<UpdateError, string> = {
    NO_INTERNET:
      'Unable to check for updates. No internet connection detected.',
    FETCH_FAILED:
      'Failed to fetch update information.',
    INVALID_RESPONSE:
      'Server response is invalid or corrupted.',
    DOWNLOAD_FAILED:
      'Update download failed.',
    INSTALL_FAILED:
      'Update installation failed.',
    UNSUPPORTED_PLATFORM:
      'Your platform is not supported for automatic updates.',
  };

  return messages[errorType] || 'An unknown error occurred.';
}
