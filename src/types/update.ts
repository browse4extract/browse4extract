/**
 * Types for automatic update system
 */

/**
 * Remote version.json file structure
 */
export interface RemoteVersionInfo {
  version: string;
  buildDate: string;
  commitHash: string;
  releaseUrl: string;
  changelog?: string[];
  downloads: {
    windows?: {
      installer?: string;
      portable?: string;
    };
    macOS?: {
      intel?: {
        dmg?: string;
        zip?: string;
      };
      arm64?: {
        dmg?: string;
        zip?: string;
      };
    };
    linux?: {
      appImage?: string;
      tarball?: string;
    };
  };
}

/**
 * Update check result
 */
export interface UpdateCheckResult {
  available: boolean;
  currentVersion: string;
  remoteVersion?: RemoteVersionInfo;
  error?: UpdateError;
}

/**
 * Possible error types during update
 */
export type UpdateError =
  | 'NO_INTERNET'
  | 'FETCH_FAILED'
  | 'INVALID_RESPONSE'
  | 'DOWNLOAD_FAILED'
  | 'INSTALL_FAILED'
  | 'UNSUPPORTED_PLATFORM';

/**
 * Download progress information
 */
export interface DownloadProgress {
  percent: number; // 0-100
  transferred: number; // Downloaded bytes
  total: number; // Total size in bytes
  speed: number; // Bytes per second
}

/**
 * Possible update launcher states
 */
export type UpdateLauncherState =
  | 'checking' // Checking for update
  | 'update-available' // Update available
  | 'downloading' // Downloading
  | 'installing' // Installing
  | 'error' // Error encountered
  | 'ready'; // Ready to launch application

/**
 * Launcher state data
 */
export interface UpdateLauncherData {
  state: UpdateLauncherState;
  currentVersion: string;
  remoteVersion?: string;
  changelog?: string[];
  progress?: DownloadProgress;
  error?: {
    type: UpdateError;
    message: string;
  };
}

/**
 * UpdateChecker configuration options
 */
export interface UpdateCheckerOptions {
  versionUrl: string;
  timeout?: number; // Timeout in ms for network requests
  autoDownload?: boolean; // Automatically download if available
}

/**
 * Current platform information
 */
export interface PlatformInfo {
  platform: 'windows' | 'macOS' | 'linux';
  arch: 'x64' | 'arm64';
  installerType: 'installer' | 'portable' | 'dmg' | 'zip' | 'appImage' | 'tarball';
}
