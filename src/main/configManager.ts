import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DebugSettings } from '../types/types';
import { logger } from './Logger';

export interface AppConfig {
  outputsPath: string;
  savesPath: string;
  enableDiscordRPC: boolean;
  debugSettings: DebugSettings;
}

export class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');

    // Default configuration
    this.config = {
      outputsPath: path.join(userDataPath, 'outputs'),
      savesPath: path.join(userDataPath, 'saves'),
      enableDiscordRPC: true, // Discord RPC enabled by default
      debugSettings: {
        enabled: false,
        showBrowser: false,
        advancedLogs: false,
        securityLevel: 'normal',
        autoScroll: true,
        handleCookies: true
      }
    };

    // Load existing config or create default
    this.loadConfig();

    // Ensure directories exist
    this.ensureDirectories();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(data);

        // SECURITY: Protect against prototype pollution
        this.config = { ...this.config, ...this.sanitizeConfig(loadedConfig) };
      } else {
        // Save default config
        this.saveConfig();
      }
    } catch (error) {
      logger.nodejs('error', `Error loading config: ${error}`);
      // Use defaults if error
    }
  }

  /**
   * SECURITY: Remove dangerous prototype pollution keys from config object
   */
  private sanitizeConfig(config: any): Partial<AppConfig> {
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      return {};
    }

    // Create new object without prototype pollution keys
    const sanitized: any = {};

    for (const key in config) {
      if (config.hasOwnProperty(key)) {
        // Skip dangerous keys that could pollute prototype
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        sanitized[key] = config[key];
      }
    }

    return sanitized;
  }

  private saveConfig(): void {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf-8');
    } catch (error) {
      logger.nodejs('error', `Error saving config: ${error}`);
    }
  }

  private ensureDirectories(): void {
    try {
      if (!fs.existsSync(this.config.outputsPath)) {
        fs.mkdirSync(this.config.outputsPath, { recursive: true });
      }
      if (!fs.existsSync(this.config.savesPath)) {
        fs.mkdirSync(this.config.savesPath, { recursive: true });
      }
    } catch (error) {
      logger.nodejs('error', `Error creating directories: ${error}`);
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public getOutputsPath(): string {
    return this.config.outputsPath;
  }

  public getSavesPath(): string {
    return this.config.savesPath;
  }

  public setOutputsPath(newPath: string): void {
    this.config.outputsPath = newPath;
    this.saveConfig();
    this.ensureDirectories();
  }

  public setSavesPath(newPath: string): void {
    this.config.savesPath = newPath;
    this.saveConfig();
    this.ensureDirectories();
  }

  public updateConfig(newConfig: Partial<AppConfig>): void {
    // SECURITY: Sanitize config before merging
    this.config = { ...this.config, ...this.sanitizeConfig(newConfig) };
    this.saveConfig();
    this.ensureDirectories();
  }

  public isDiscordRPCEnabled(): boolean {
    return this.config.enableDiscordRPC;
  }

  public setDiscordRPCEnabled(enabled: boolean): void {
    this.config.enableDiscordRPC = enabled;
    this.saveConfig();
  }

  public getDebugSettings(): DebugSettings {
    return { ...this.config.debugSettings };
  }

  public updateDebugSettings(settings: Partial<DebugSettings>): void {
    this.config.debugSettings = { ...this.config.debugSettings, ...settings };
    this.saveConfig();
  }

  public setDebugSettings(settings: DebugSettings): void {
    this.config.debugSettings = settings;
    this.saveConfig();
  }
}
