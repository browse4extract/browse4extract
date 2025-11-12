/**
 * Centralized Logger - Manages all application logs with categories
 * SECURITY: Automatically sanitizes sensitive data before logging
 */

import { EventEmitter } from 'events';
import { sanitizeMessage } from './logSanitizer';

export type LogCategory = 'nodejs' | 'electron' | 'puppeteer' | 'Browse4Extract';
export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

export interface AdvancedLogMessage {
  timestamp: string;
  category: LogCategory;
  level: LogLevel;
  message: string;
  sanitized: boolean;
}

export class Logger extends EventEmitter {
  private static instance: Logger | null = null;
  private debugEnabled: boolean = false;
  private advancedLogsEnabled: boolean = false;
  private isLogging: boolean = false; // Recursion guard
  private originalConsole: typeof console | null = null;

  private constructor() {
    super();
  }

  /**
   * Get singleton instance of Logger
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Configure logger settings
   */
  public configure(settings: { debugEnabled: boolean; advancedLogsEnabled: boolean; originalConsole?: any }): void {
    this.debugEnabled = settings.debugEnabled;
    this.advancedLogsEnabled = settings.advancedLogsEnabled;
    if (settings.originalConsole) {
      this.originalConsole = settings.originalConsole;
    }
  }

  /**
   * Log a message with automatic sanitization
   * @param category - Log category (nodejs, electron, puppeteer, app)
   * @param level - Log level
   * @param message - Raw message (will be sanitized)
   * @param skipSanitization - Skip sanitization if true (use with caution)
   */
  public log(
    category: LogCategory,
    level: LogLevel,
    message: string,
    skipSanitization: boolean = false
  ): void {
    // SECURITY: Recursion guard - prevent infinite loops
    if (this.isLogging) {
      return;
    }

    this.isLogging = true;

    try {
      // Skip debug logs if debug mode is disabled
      if (level === 'debug' && !this.debugEnabled) {
        return;
      }

      // Sanitize message to remove sensitive data
      const sanitized = skipSanitization ? message : sanitizeMessage(message);
      const wasSanitized = sanitized !== message;

      const logMessage: AdvancedLogMessage = {
        timestamp: new Date().toISOString(),
        category,
        level,
        message: sanitized,
        sanitized: wasSanitized,
      };

      // Emit to advanced logs window if enabled
      if (this.advancedLogsEnabled) {
        this.emit('advanced-log', logMessage);
      }

      // SECURITY: Use original console to prevent infinite recursion
      if (this.debugEnabled && this.originalConsole) {
        const prefix = `[${category.toUpperCase()}/${level.toUpperCase()}]`;
        switch (level) {
          case 'error':
            this.originalConsole.error(prefix, sanitized);
            break;
          case 'warning':
            this.originalConsole.warn(prefix, sanitized);
            break;
          default:
            this.originalConsole.log(prefix, sanitized);
        }
      }
    } finally {
      this.isLogging = false;
    }
  }

  /**
   * Convenience methods for different log levels
   */

  public info(category: LogCategory, message: string): void {
    this.log(category, 'info', message);
  }

  public success(category: LogCategory, message: string): void {
    this.log(category, 'success', message);
  }

  public warning(category: LogCategory, message: string): void {
    this.log(category, 'warning', message);
  }

  public error(category: LogCategory, message: string | Error): void {
    const msg = message instanceof Error ? message.message : message;
    this.log(category, 'error', msg);
  }

  public debug(category: LogCategory, message: string): void {
    this.log(category, 'debug', message);
  }

  /**
   * Category-specific methods for cleaner code
   */

  public nodejs(level: LogLevel, message: string): void {
    this.log('nodejs', level, message);
  }

  public electron(level: LogLevel, message: string): void {
    this.log('electron', level, message);
  }

  public puppeteer(level: LogLevel, message: string): void {
    this.log('puppeteer', level, message);
  }

  public browse4extract(level: LogLevel, message: string): void {
    this.log('Browse4Extract', level, message);
  }

  /**
   * Check if debug mode is enabled
   */
  public isDebugEnabled(): boolean {
    return this.debugEnabled;
  }

  /**
   * Check if advanced logs are enabled
   */
  public isAdvancedLogsEnabled(): boolean {
    return this.advancedLogsEnabled;
  }

  /**
   * Clear all event listeners (for cleanup)
   */
  public cleanup(): void {
    this.removeAllListeners();
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
