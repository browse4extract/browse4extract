import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { execFile } from 'child_process';
import type {
  UpdateCheckResult,
  RemoteVersionInfo,
  DownloadProgress,
  UpdateCheckerOptions,
  PlatformInfo,
  UpdateError,
} from '../types/update';

/**
 * Gestionnaire de vérification et installation des mises à jour
 */
export class UpdateChecker {
  private versionUrl: string;
  private timeout: number;

  constructor(options: UpdateCheckerOptions) {
    this.versionUrl = options.versionUrl;
    this.timeout = options.timeout || 10000; // 10 secondes par défaut
  }

  /**
   * Check if an update is available
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      const remoteVersion = await this.fetchRemoteVersion();
      const currentVersion = app.getVersion();

      // Fetch changelog separately (non-blocking)
      try {
        const changelog = await this.fetchChangelog(remoteVersion.version);
        if (changelog && changelog.changes) {
          remoteVersion.changelog = changelog.changes;
        }
      } catch (error) {
        // Changelog fetch failed, continue without it (non-critical)
        console.warn('Failed to fetch changelog:', error);
      }

      const available = this.isNewerVersion(
        remoteVersion.version,
        currentVersion
      );

      return {
        available,
        currentVersion,
        remoteVersion,
      };
    } catch (error) {
      const errorType = this.categorizeError(error);
      return {
        available: false,
        currentVersion: app.getVersion(),
        error: errorType,
      };
    }
  }

  /**
   * Récupère les informations de version depuis l'URL distante
   */
  private async fetchRemoteVersion(): Promise<RemoteVersionInfo> {
    return new Promise((resolve, reject) => {
      const request = https.get(
        this.versionUrl,
        { timeout: this.timeout },
        (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Failed to fetch version: HTTP ${response.statusCode}`
              )
            );
            return;
          }

          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            try {
              const parsed = JSON.parse(data) as RemoteVersionInfo;
              resolve(parsed);
            } catch (error) {
              reject(new Error('Invalid JSON response'));
            }
          });
        }
      );

      request.on('error', (error) => {
        reject(error);
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Fetch changelog.json from remote server
   */
  private async fetchChangelog(_version: string): Promise<{
    version: string;
    releaseDate: string;
    changes: string[];
    releaseUrl: string;
  } | null> {
    return new Promise((resolve) => {
      // Derive changelog URL from version URL
      const changelogUrl = this.versionUrl.replace('version.json', 'changelog.json');

      const request = https.get(
        changelogUrl,
        { timeout: this.timeout },
        (response) => {
          if (response.statusCode !== 200) {
            // Changelog not found is not critical, return null
            resolve(null);
            return;
          }

          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (error) {
              // Invalid JSON, not critical
              resolve(null);
            }
          });
        }
      );

      request.on('error', () => {
        // Error fetching changelog, not critical
        resolve(null);
      });

      request.on('timeout', () => {
        request.destroy();
        resolve(null);
      });
    });
  }

  /**
   * Compare two semantic versions (e.g.: 1.2.0 vs 1.2.1)
   * @returns true if remoteVersion is newer than currentVersion
   */
  private isNewerVersion(
    remoteVersion: string,
    currentVersion: string
  ): boolean {
    const remote = remoteVersion.split('.').map(Number);
    const current = currentVersion.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (remote[i] > current[i]) return true;
      if (remote[i] < current[i]) return false;
    }

    return false; // Versions identiques
  }

  /**
   * Télécharge et installe la mise à jour
   * @param remoteVersion Informations de la version distante
   * @param onProgress Callback appelé pour suivre la progression
   * @returns Object indicating if automatic restart is required
   */
  async downloadAndInstall(
    remoteVersion: RemoteVersionInfo,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<{ requiresRestart: boolean; platform: string }> {
    const platformInfo = this.getPlatformInfo();
    const downloadUrl = this.getDownloadUrl(remoteVersion, platformInfo);

    if (!downloadUrl) {
      throw new Error('No download URL available for this platform');
    }

    // Security: Enforce HTTPS-only downloads
    if (!downloadUrl.startsWith('https://')) {
      throw new Error('Insecure download URL: HTTPS is required for updates');
    }

    // Security: Validate download URL comes from trusted domain
    try {
      const urlObj = new URL(downloadUrl);
      const trustedDomains = [
        'github.com',
        'objects.githubusercontent.com',
        'github-releases.githubusercontent.com'
      ];

      if (!trustedDomains.includes(urlObj.hostname)) {
        throw new Error(`Untrusted download domain: ${urlObj.hostname}. Only GitHub releases are allowed.`);
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid download URL format');
      }
      throw error;
    }

    // Download installer
    const installerPath = await this.downloadFile(downloadUrl, onProgress);

    // Install according to platform
    await this.installUpdate(installerPath, platformInfo);

    // macOS requires manual installation, so app should continue running
    // Windows and Linux automatically restart
    return {
      requiresRestart: platformInfo.platform !== 'macOS',
      platform: platformInfo.platform
    };
  }

  /**
   * Obtient les informations de la plateforme actuelle
   */
  private getPlatformInfo(): PlatformInfo {
    const platform = process.platform as 'win32' | 'darwin' | 'linux';
    const arch = process.arch as 'x64' | 'arm64';

    let platformName: 'windows' | 'macOS' | 'linux';
    let installerType: PlatformInfo['installerType'];

    switch (platform) {
      case 'win32':
        platformName = 'windows';
        installerType = 'installer'; // Préférer l'installer NSIS
        break;
      case 'darwin':
        platformName = 'macOS';
        installerType = 'dmg'; // Préférer DMG
        break;
      case 'linux':
        platformName = 'linux';
        installerType = 'appImage'; // Préférer AppImage
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    return { platform: platformName, arch, installerType };
  }

  /**
   * Obtient l'URL de téléchargement appropriée pour la plateforme
   */
  private getDownloadUrl(
    remoteVersion: RemoteVersionInfo,
    platformInfo: PlatformInfo
  ): string | undefined {
    const { platform, arch, installerType } = platformInfo;

    switch (platform) {
      case 'windows':
        const winDownloads = remoteVersion.downloadLinks.windows;
        if (!winDownloads) return undefined;

        if (installerType === 'installer') return winDownloads.installer;
        if (installerType === 'portable') return winDownloads.portable;
        return winDownloads.installer; // Fallback

      case 'macOS':
        const macArch = arch === 'arm64' ? 'arm64' : 'intel';
        const macDownloads = remoteVersion.downloadLinks.macos?.[macArch];
        if (!macDownloads) return undefined;

        if (installerType === 'dmg') return macDownloads.dmg;
        if (installerType === 'zip') return macDownloads.zip;
        return macDownloads.dmg; // Fallback

      case 'linux':
        const linuxDownloads = remoteVersion.downloadLinks.linux;
        if (!linuxDownloads) return undefined;

        if (installerType === 'appImage') return linuxDownloads.appimage;
        if (installerType === 'tarball') return linuxDownloads.tarball;
        return linuxDownloads.appimage; // Fallback
    }
  }

  /**
   * Download file with progress tracking
   * @param redirectCount Internal parameter to track redirect count (max 5)
   */
  private async downloadFile(
    url: string,
    onProgress: (progress: DownloadProgress) => void,
    redirectCount: number = 0
  ): Promise<string> {
    // Security: Limit redirects to prevent infinite loops
    if (redirectCount > 5) {
      throw new Error('Too many redirects (max 5)');
    }

    return new Promise((resolve, reject) => {
      const tempDir = app.getPath('temp');
      const fileName = `Browse4Extract-Update-${Date.now()}${this.getFileExtension(url)}`;
      const filePath = path.join(tempDir, fileName);

      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(filePath);

      const startTime = Date.now();
      let downloadedBytes = 0;

      const request = protocol.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(filePath);
            // Recursive call with incremented redirect count
            this.downloadFile(redirectUrl, onProgress, redirectCount + 1)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(`Download failed: HTTP ${response.statusCode}`)
          );
          return;
        }

        const totalBytes = parseInt(
          response.headers['content-length'] || '0',
          10
        );

        // Security: Validate file size (max 500MB for installers)
        const MAX_DOWNLOAD_SIZE = 500 * 1024 * 1024; // 500MB
        if (totalBytes > MAX_DOWNLOAD_SIZE) {
          file.close();
          fs.unlink(filePath, () => {});
          reject(new Error(`Download too large: ${totalBytes} bytes (max ${MAX_DOWNLOAD_SIZE})`));
          return;
        }

        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;

          // Security: Check downloaded bytes don't exceed declared size
          if (downloadedBytes > totalBytes + 1024) { // Allow 1KB tolerance
            file.close();
            fs.unlink(filePath, () => {});
            reject(new Error('Downloaded size exceeds declared content-length'));
            return;
          }

          const elapsed = (Date.now() - startTime) / 1000; // secondes
          const speed = elapsed > 0 ? downloadedBytes / elapsed : 0;
          const percent =
            totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

          onProgress({
            percent: Math.min(percent, 100),
            transferred: downloadedBytes,
            total: totalBytes,
            speed,
          });
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();

          // Security: Verify downloaded file size matches expected
          try {
            const stats = fs.statSync(filePath);
            if (totalBytes > 0 && Math.abs(stats.size - totalBytes) > 1024) {
              fs.unlink(filePath, () => {});
              reject(new Error(`Downloaded file size mismatch: expected ${totalBytes}, got ${stats.size}`));
              return;
            }

            // Security: Verify file is not empty
            if (stats.size === 0) {
              fs.unlink(filePath, () => {});
              reject(new Error('Downloaded file is empty'));
              return;
            }

            resolve(filePath);
          } catch (error) {
            fs.unlink(filePath, () => {});
            reject(new Error(`Failed to verify downloaded file: ${error}`));
          }
        });
      });

      request.on('error', (error) => {
        file.close();
        fs.unlink(filePath, () => {}); // Nettoyer le fichier partiel
        reject(error);
      });

      file.on('error', (error) => {
        file.close();
        fs.unlink(filePath, () => {});
        reject(error);
      });
    });
  }

  /**
   * Installe la mise à jour selon la plateforme
   */
  private async installUpdate(
    installerPath: string,
    platformInfo: PlatformInfo
  ): Promise<void> {
    try {
      switch (platformInfo.platform) {
        case 'windows':
          await this.installWindows(installerPath);
          break;
        case 'macOS':
          await this.installMacOS(installerPath);
          break;
        case 'linux':
          await this.installLinux(installerPath);
          break;
      }
    } catch (error) {
      throw new Error(`Installation failed: ${error}`);
    }
  }

  /**
   * Installation Windows (NSIS)
   */
  private async installWindows(installerPath: string): Promise<void> {
    // Lancer l'installeur en mode silencieux
    // /S = silent, /D= répertoire d'installation
    const installDir = path.dirname(app.getPath('exe'));

    try {
      // Exécuter l'installeur
      execFile(installerPath, ['/S', `/D=${installDir}`], (error) => {
        if (error) {
          console.error('Installation error:', error);
        }
        // Après l'installation, redémarrer l'application
        app.relaunch();
        app.exit(0);
      });
    } catch (error) {
      throw new Error(`Windows installation failed: ${error}`);
    }
  }

  /**
   * Installation macOS (DMG)
   */
  private async installMacOS(installerPath: string): Promise<void> {
    // Sur macOS, on peut monter le DMG et copier l'app
    // Pour simplifier, on demande à l'utilisateur de le faire manuellement
    // ou utiliser electron-updater pour une gestion automatique

    // Option 1: Ouvrir le DMG pour que l'utilisateur installe
    execFile('open', [installerPath], (error) => {
      if (error) {
        console.error('Failed to open DMG:', error);
      }
    });

    // Note: Pour une installation complètement automatique sur macOS,
    // il faudrait implémenter le montage du DMG et la copie de l'app
  }

  /**
   * Installation Linux (AppImage)
   */
  private async installLinux(installerPath: string): Promise<void> {
    // Remplacer l'AppImage actuel par le nouveau
    const currentPath = app.getPath('exe');
    const backupPath = `${currentPath}.backup`;

    try {
      // Backup de l'ancien
      fs.copyFileSync(currentPath, backupPath);

      // Remplacer par le nouveau
      fs.copyFileSync(installerPath, currentPath);
      fs.chmodSync(currentPath, '755'); // Rendre exécutable

      // Redémarrer
      app.relaunch();
      app.exit(0);
    } catch (error) {
      // Restaurer le backup en cas d'erreur
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, currentPath);
      }
      throw new Error(`Linux installation failed: ${error}`);
    }
  }

  /**
   * Détermine l'extension du fichier depuis l'URL avec validation stricte
   * Security: Use strict regex to prevent path traversal
   */
  private getFileExtension(url: string): string {
    // Extract filename from URL (after last /)
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1];

    // Strict regex validation for allowed extensions
    if (/\.exe$/i.test(filename)) return '.exe';
    if (/\.dmg$/i.test(filename)) return '.dmg';
    if (/\.AppImage$/i.test(filename)) return '.AppImage';
    if (/\.zip$/i.test(filename)) return '.zip';
    if (/\.tar\.gz$/i.test(filename)) return '.tar.gz';

    // No valid extension found
    throw new Error(`Invalid or unsupported file extension in URL: ${filename}`);
  }

  /**
   * Catégorise une erreur en type d'erreur de mise à jour
   */
  private categorizeError(error: any): UpdateError {
    const message = error?.message?.toLowerCase() || '';

    if (
      message.includes('enotfound') ||
      message.includes('econnrefused') ||
      message.includes('timeout')
    ) {
      return 'NO_INTERNET';
    }

    if (message.includes('invalid json')) {
      return 'INVALID_RESPONSE';
    }

    if (message.includes('download')) {
      return 'DOWNLOAD_FAILED';
    }

    if (message.includes('install')) {
      return 'INSTALL_FAILED';
    }

    if (message.includes('unsupported platform')) {
      return 'UNSUPPORTED_PLATFORM';
    }

    return 'FETCH_FAILED';
  }
}
