import * as DiscordRPC from 'discord-rpc';
import { logger } from './Logger';

// Discord Configuration
// To use Discord RPC:
// 1. Create a Discord Application at https://discord.com/developers/applications
// 2. Copy your Application ID
// 3. Replace the CLIENT_ID below or use environment variables
// NOTE: This CLIENT_ID is public and safe to commit (it's not a secret)
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1433499788418089024';
const PROJECT_URL = process.env.PROJECT_URL || 'https://github.com/browse4extract/browse4extract';

export class DiscordRpcService {
  private client: DiscordRPC.Client | null = null;
  private isConnected: boolean = false;
  private startTimestamp: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 10000; // 10 seconds
  private currentDomain: string = '';

  /**
   * Truncate string to Discord's 128 character limit
   */
  private truncateText(text: string, maxLength: number = 128): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Calculate percentage of progress
   */
  private calculateProgress(current: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((current / total) * 100);
  }

  /**
   * Format domain name for display
   */
  private formatDomain(domain: string): string {
    // Remove protocol and www
    return domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }

  /**
   * Initialize and connect to Discord RPC
   */
  async initialize(): Promise<void> {
    try {
      this.client = new DiscordRPC.Client({ transport: 'ipc' });

      this.client.on('ready', () => {
        logger.electron('info', 'Discord RPC: Connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        this.setIdle();
      });

      this.client.on('disconnected', () => {
        logger.electron('info', 'Discord RPC: Disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      });

      await this.client.login({ clientId: CLIENT_ID });
    } catch (error) {
      logger.electron('error', `Discord RPC: Failed to initialize - ${error}`);
      // Don't throw - Discord might not be running, which is fine
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect to Discord RPC
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.electron('warning', 'Discord RPC: Max reconnection attempts reached. Giving up.');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    logger.electron('info', `Discord RPC: Attempting reconnection (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}) in ${this.RECONNECT_DELAY / 1000}s...`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.electron('error', `Discord RPC: Reconnection failed - ${error}`);
      }
    }, this.RECONNECT_DELAY);
  }

  /**
   * Set presence to idle state
   */
  setIdle(): void {
    if (!this.isConnected || !this.client) return;

    try {
      this.currentDomain = '';
      this.startTimestamp = 0;

      this.client.setActivity({
        details: this.truncateText('💤 Waiting for action'),
        state: this.truncateText('Ready to extract data'),
        largeImageKey: 'logo',
        largeImageText: this.truncateText('Browse4Extract - Web Data Extractor'),
        smallImageKey: 'idle',
        smallImageText: this.truncateText('By Sielanse @ SieApps'),
        buttons: [
          { label: 'View Project', url: PROJECT_URL }
        ]
      });
    } catch (error) {
      logger.electron('error', `Discord RPC: Failed to set idle state - ${error}`);
    }
  }

  /**
   * Set presence during scraping
   * @param domain - Website domain being scraped
   * @param currentStep - Current item number
   * @param totalSteps - Total items to scrape
   */
  setScraping(domain: string, currentStep: number, totalSteps: number): void {
    if (!this.isConnected || !this.client) return;

    try {
      // Set start timestamp on first step
      if (currentStep === 1) {
        this.startTimestamp = Date.now();
        this.currentDomain = domain;
      }

      const formattedDomain = this.formatDomain(domain);
      const progress = this.calculateProgress(currentStep, totalSteps);

      // Choose emoji based on progress
      let emoji = '🔍';
      if (progress >= 75) emoji = '🚀';
      else if (progress >= 50) emoji = '⚡';
      else if (progress >= 25) emoji = '📊';

      this.client.setActivity({
        details: this.truncateText(`${emoji} Extracting from ${formattedDomain}`),
        state: this.truncateText(`${currentStep}/${totalSteps} items (${progress}%)`),
        startTimestamp: this.startTimestamp,
        largeImageKey: 'logo',
        largeImageText: this.truncateText(`Scraping ${formattedDomain} - ${progress}% complete`),
        smallImageKey: 'scraping',
        smallImageText: this.truncateText('By Sielanse @ SieApps'),
        buttons: [
          { label: 'View Project', url: PROJECT_URL },
          { label: 'Visit Site', url: domain.startsWith('http') ? domain : `https://${domain}` }
        ]
      });
    } catch (error) {
      logger.electron('error', `Discord RPC: Failed to set scraping state - ${error}`);
    }
  }

  /**
   * Set presence when scraping is completed
   * @param itemCount - Number of items extracted
   * @param domain - Website domain that was scraped
   */
  setCompleted(itemCount: number, domain: string): void {
    if (!this.isConnected || !this.client) return;

    try {
      const formattedDomain = this.formatDomain(domain);
      const endTimestamp = Date.now();

      // Calculate duration if we have a start timestamp
      let durationText = '';
      if (this.startTimestamp > 0) {
        const durationSeconds = Math.floor((endTimestamp - this.startTimestamp) / 1000);
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;

        if (minutes > 0) {
          durationText = ` in ${minutes}m ${seconds}s`;
        } else {
          durationText = ` in ${seconds}s`;
        }
      }

      this.client.setActivity({
        details: this.truncateText(`✅ Extraction completed${durationText}`),
        state: this.truncateText(`${itemCount} items from ${formattedDomain}`),
        largeImageKey: 'logo',
        largeImageText: this.truncateText(`Successfully extracted ${itemCount} items`),
        smallImageKey: 'success',
        smallImageText: this.truncateText('By Sielanse @ SieApps'),
        buttons: [
          { label: 'View Project', url: PROJECT_URL },
          { label: 'Visit Site', url: domain.startsWith('http') ? domain : `https://${domain}` }
        ]
      });

      // Reset to idle after 15 seconds
      setTimeout(() => {
        this.setIdle();
      }, 15000);
    } catch (error) {
      logger.electron('error', `Discord RPC: Failed to set completed state - ${error}`);
    }
  }

  /**
   * Set presence when an error occurs
   * @param error - Error message
   */
  setError(error: string): void {
    if (!this.isConnected || !this.client) return;

    try {
      const domainInfo = this.currentDomain ? ` (${this.formatDomain(this.currentDomain)})` : '';

      this.client.setActivity({
        details: this.truncateText(`❌ Extraction failed${domainInfo}`),
        state: this.truncateText(error),
        largeImageKey: 'logo',
        largeImageText: this.truncateText('An error occurred during extraction'),
        smallImageKey: 'error',
        smallImageText: this.truncateText('By Sielanse @ SieApps'),
        buttons: [
          { label: 'View Project', url: PROJECT_URL },
          { label: 'Report Issue', url: `${PROJECT_URL}/issues` }
        ]
      });

      // Reset to idle after 15 seconds
      setTimeout(() => {
        this.setIdle();
      }, 15000);
    } catch (error) {
      logger.electron('error', `Discord RPC: Failed to set error state - ${error}`);
    }
  }

  /**
   * Clear the presence
   */
  clearActivity(): void {
    if (!this.isConnected || !this.client) return;

    try {
      this.client.clearActivity();
    } catch (error) {
      logger.electron('error', `Discord RPC: Failed to clear activity - ${error}`);
    }
  }

  /**
   * Destroy the RPC client and disconnect
   */
  async destroy(): Promise<void> {
    // Clear reconnect timeout if any
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.client) {
      try {
        this.clearActivity();
        await this.client.destroy();
        this.isConnected = false;
        this.client = null;
        logger.electron('info', 'Discord RPC: Destroyed');
      } catch (error) {
        logger.electron('error', `Discord RPC: Failed to destroy - ${error}`);
      }
    }
  }

}
