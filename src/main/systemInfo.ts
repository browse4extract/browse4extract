/**
 * System Information Detector
 * Detects real system hardware and locale to create consistent browser fingerprints
 * This prevents detection by ensuring navigator properties match the actual system
 */

import * as os from 'os';
import { app } from 'electron';

export interface SystemInfo {
  cpuCores: number;
  deviceMemory: number;
  platform: string;
  languages: string[];
  userAgentPlatform: string;
}

export class SystemInfoDetector {
  private static instance: SystemInfo | null = null;

  /**
   * Get system information (cached for performance)
   */
  static getSystemInfo(): SystemInfo {
    if (!this.instance) {
      this.instance = this.detectSystemInfo();
    }
    return this.instance;
  }

  /**
   * Detect real system information
   */
  private static detectSystemInfo(): SystemInfo {
    // CPU cores (logical cores including hyperthreading)
    const cpuCores = os.cpus().length;

    // Device memory (rounded to valid navigator.deviceMemory values)
    const deviceMemory = this.calculateDeviceMemory();

    // Platform
    const platform = this.getNavigatorPlatform();

    // Languages
    const languages = this.getSystemLanguages();

    // User agent platform string
    const userAgentPlatform = this.getUserAgentPlatform();

    return {
      cpuCores,
      deviceMemory,
      platform,
      languages,
      userAgentPlatform
    };
  }

  /**
   * Calculate device memory (rounded to valid navigator.deviceMemory values)
   * Valid values per Web API spec: 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256
   */
  private static calculateDeviceMemory(): number {
    const totalMemoryBytes = os.totalmem();
    const totalMemoryGB = totalMemoryBytes / (1024 ** 3);

    // Valid deviceMemory values per Web API spec
    const validValues = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256];

    // Find closest valid value (round down for privacy)
    let closestValue = validValues[0];
    for (const value of validValues) {
      if (totalMemoryGB >= value) {
        closestValue = value;
      } else {
        break;
      }
    }

    return closestValue;
  }

  /**
   * Get navigator.platform value from process.platform
   */
  private static getNavigatorPlatform(): string {
    const platformMap: Record<string, string> = {
      'win32': 'Win32',
      'darwin': 'MacIntel',
      'linux': 'Linux x86_64',
      'freebsd': 'FreeBSD',
      'openbsd': 'OpenBSD',
      'sunos': 'SunOS'
    };

    return platformMap[process.platform] || 'Linux x86_64';
  }

  /**
   * Get system languages for navigator.languages
   */
  private static getSystemLanguages(): string[] {
    const locale = app.getLocale(); // e.g., 'en-US', 'fr', 'de-DE', etc.

    // Handle locale format variations
    if (locale.includes('-')) {
      const [lang, region] = locale.split('-');
      return [`${lang}-${region.toUpperCase()}`, lang];
    } else {
      // If only language code, add common default region
      const defaultRegions: Record<string, string> = {
        'en': 'US',
        'fr': 'FR',
        'de': 'DE',
        'es': 'ES',
        'it': 'IT',
        'pt': 'BR',
        'ja': 'JP',
        'ko': 'KR',
        'zh': 'CN',
        'ru': 'RU',
        'ar': 'SA',
        'nl': 'NL',
        'pl': 'PL',
        'tr': 'TR',
        'vi': 'VN',
        'th': 'TH',
        'sv': 'SE',
        'da': 'DK',
        'fi': 'FI',
        'no': 'NO'
      };

      const region = defaultRegions[locale] || 'US';
      return [`${locale}-${region}`, locale];
    }
  }

  /**
   * Get user agent platform string based on OS
   */
  private static getUserAgentPlatform(): string {
    const platform = process.platform;
    const arch = process.arch;

    switch (platform) {
      case 'win32':
        // Windows always reports "Windows NT 10.0" for Windows 10/11
        return 'Windows NT 10.0; Win64; x64';

      case 'darwin': {
        // Detect macOS version (rough approximation from Darwin kernel)
        const osRelease = os.release();
        const parts = osRelease.split('.');
        const majorVersion = parseInt(parts[0] || '20', 10);

        // Darwin kernel to macOS version mapping
        // Darwin 20 = macOS 11 (Big Sur), Darwin 21 = macOS 12 (Monterey), etc.
        const macOSMinorVersion = majorVersion >= 20 ? majorVersion - 9 : 15;

        return `Macintosh; Intel Mac OS X 10_${macOSMinorVersion}_7`;
      }

      case 'linux':
        // Linux user agents vary, but generic X11 format is most common
        return `X11; Linux ${arch === 'x64' ? 'x86_64' : arch}`;

      default:
        return 'X11; Linux x86_64';
    }
  }

  /**
   * Validate Chrome version format
   * SECURITY: Prevent injection by ensuring version follows X.X.X.X format
   */
  private static validateChromeVersion(version: string): boolean {
    // Valid format: major.minor.build.patch (e.g., 135.0.0.0)
    const versionRegex = /^\d+\.\d+\.\d+\.\d+$/;
    return versionRegex.test(version);
  }

  /**
   * Generate realistic user agent based on real system
   * @param chromeVersion Chrome version to use (default: latest stable)
   */
  static generateUserAgent(chromeVersion: string = '135.0.0.0'): string {
    // SECURITY: Validate Chrome version format to prevent injection
    if (!this.validateChromeVersion(chromeVersion)) {
      throw new Error(`Invalid Chrome version format: ${chromeVersion}. Expected format: X.X.X.X`);
    }

    const systemInfo = this.getSystemInfo();

    return `Mozilla/5.0 (${systemInfo.userAgentPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  }

  /**
   * Get multiple user agent variations for rotation (all matching real system)
   */
  static getUserAgentVariations(): string[] {
    const versions = ['135.0.0.0', '134.0.6998.166', '133.0.6943.112'];
    return versions.map(version => this.generateUserAgent(version));
  }
}
