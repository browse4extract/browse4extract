import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  outputsPath: string;
  savesPath: string;
  enableDiscordRPC: boolean;
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
      enableDiscordRPC: true // Discord RPC enabled by default
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
        this.config = { ...this.config, ...loadedConfig };
      } else {
        // Save default config
        this.saveConfig();
      }
    } catch (error) {
      console.error('Error loading config:', error);
      // Use defaults if error
    }
  }

  private saveConfig(): void {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf-8');
    } catch (error) {
      console.error('Error saving config:', error);
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
      console.error('Error creating directories:', error);
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
    this.config = { ...this.config, ...newConfig };
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
}
