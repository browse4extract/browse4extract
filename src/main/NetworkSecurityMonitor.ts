/**
 * Network Security Monitor - Intercepts Puppeteer network traffic
 * SECURITY: Detects and logs suspicious patterns in network requests/responses
 */

import { Page } from 'puppeteer-core';
import { logger } from './Logger';
import { containsSensitiveData } from './logSanitizer';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export type SecurityLevel = 'relaxed' | 'normal' | 'strict' | 'paranoid';

// Constants for log rotation
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_LOG_BACKUPS = 5;

export class NetworkSecurityMonitor {
  private page: Page;
  private securityLevel: SecurityLevel;
  private suspiciousLogPath: string;
  private suspiciousCount: number = 0;

  constructor(page: Page, securityLevel: SecurityLevel = 'normal') {
    this.page = page;
    this.securityLevel = securityLevel;

    // Create suspicious.log in userData/logs
    const userDataPath = app.getPath('userData');
    const logsDir = path.join(userDataPath, 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.suspiciousLogPath = path.join(logsDir, 'suspicious.log');
  }

  /**
   * Initialize network interception
   */
  public async initialize(): Promise<void> {
    try {
      // Enable request interception (required for adblocker plugin)
      await this.page.setRequestInterception(true);

      // Intercept all requests - observe only, don't block
      this.page.on('request', (request) => {
        this.inspectRequest(request);

        // Only continue if not already handled by adblocker or other interceptors
        if (!request.isInterceptResolutionHandled()) {
          request.continue().catch(() => {
            // Ignore errors if request was handled between check and continue
          });
        }
      });

      // Intercept all responses
      this.page.on('response', async (response) => {
        await this.inspectResponse(response);
      });

      logger.puppeteer('info', 'Network security monitor initialized');
    } catch (error) {
      logger.puppeteer('error', `Failed to initialize network monitor: ${error}`);
    }
  }

  /**
   * Inspect outgoing request for sensitive data
   */
  private inspectRequest(request: any): void {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();
    const postData = request.postData();

    // Log request (will be sanitized by logger)
    logger.puppeteer('debug', `${method} ${url}`);

    // SECURITY: Check for suspicious patterns
    const suspicious: string[] = [];

    // Check URL for credentials
    if (/:\/\/[^:]+:[^@]+@/.test(url)) {
      suspicious.push('Credentials in URL');
      this.logSuspicious('REQUEST_URL_CREDENTIALS', { url, method });
    }

    // Check headers for tokens/secrets
    if (headers) {
      const headerStr = JSON.stringify(headers);
      if (containsSensitiveData(headerStr)) {
        suspicious.push('Sensitive data in headers');
        if (this.securityLevel === 'strict' || this.securityLevel === 'paranoid') {
          this.logSuspicious('REQUEST_SENSITIVE_HEADERS', {
            url,
            method,
            headers: Object.keys(headers)
          });
        }
      }
    }

    // Check POST data
    if (postData) {
      if (containsSensitiveData(postData)) {
        suspicious.push('Sensitive data in POST body');
        if (this.securityLevel === 'strict' || this.securityLevel === 'paranoid') {
          this.logSuspicious('REQUEST_SENSITIVE_POSTDATA', {
            url,
            method,
            bodyLength: postData.length
          });
        }
      }
    }

    // Alert if suspicious
    if (suspicious.length > 0) {
      logger.puppeteer('warning', `Suspicious request detected: ${suspicious.join(', ')} - ${url}`);
    }
  }

  /**
   * Inspect incoming response for sensitive data
   */
  private async inspectResponse(response: any): Promise<void> {
    const url = response.url();
    const status = response.status();
    const headers = response.headers();

    // Log response (will be sanitized by logger)
    logger.puppeteer('debug', `← ${status} ${url}`);

    // SECURITY: Check Set-Cookie headers
    if (headers['set-cookie']) {
      if (this.securityLevel === 'paranoid') {
        this.logSuspicious('RESPONSE_SET_COOKIE', {
          url,
          status,
          cookieCount: Array.isArray(headers['set-cookie']) ? headers['set-cookie'].length : 1
        });
      }
    }

    // Check response body for secrets (only in strict/paranoid mode)
    if (this.securityLevel === 'strict' || this.securityLevel === 'paranoid') {
      try {
        // Only check text responses
        const contentType = headers['content-type'] || '';
        if (contentType.includes('text') || contentType.includes('json') || contentType.includes('javascript')) {
          const text = await response.text();

          if (text && containsSensitiveData(text)) {
            this.logSuspicious('RESPONSE_SENSITIVE_DATA', {
              url,
              status,
              contentType,
              bodyLength: text.length
            });

            logger.puppeteer('warning', `Sensitive data detected in response: ${url}`);
          }
        }
      } catch (error) {
        // Ignore errors reading response body
      }
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  private rotateLogIfNeeded(): void {
    try {
      if (!fs.existsSync(this.suspiciousLogPath)) {
        return;
      }

      const stats = fs.statSync(this.suspiciousLogPath);
      if (stats.size < MAX_LOG_SIZE_BYTES) {
        return;
      }

      // Rotate existing backups
      for (let i = MAX_LOG_BACKUPS - 1; i >= 1; i--) {
        const oldPath = `${this.suspiciousLogPath}.${i}`;
        const newPath = `${this.suspiciousLogPath}.${i + 1}`;

        if (fs.existsSync(oldPath)) {
          if (i === MAX_LOG_BACKUPS - 1) {
            // Delete oldest backup
            fs.unlinkSync(oldPath);
          } else {
            fs.renameSync(oldPath, newPath);
          }
        }
      }

      // Move current log to .1
      fs.renameSync(this.suspiciousLogPath, `${this.suspiciousLogPath}.1`);
      logger.nodejs('info', `Rotated suspicious.log (size: ${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
    } catch (error) {
      logger.nodejs('error', `Failed to rotate suspicious.log: ${error}`);
    }
  }

  /**
   * Log suspicious activity to suspicious.log
   */
  private logSuspicious(type: string, details: any): void {
    this.suspiciousCount++;

    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      details,
      securityLevel: this.securityLevel,
      suspiciousCount: this.suspiciousCount
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      // Check if log rotation is needed before writing
      this.rotateLogIfNeeded();

      fs.appendFileSync(this.suspiciousLogPath, logLine, 'utf-8');
    } catch (error) {
      logger.nodejs('error', `Failed to write to suspicious.log: ${error}`);
    }

    // Also log to advanced logs
    logger.puppeteer('warning', `[SECURITY] ${type}: ${JSON.stringify(details)}`);
  }

  /**
   * Get suspicious activity count
   */
  public getSuspiciousCount(): number {
    return this.suspiciousCount;
  }

  /**
   * Get suspicious log file path
   */
  public getSuspiciousLogPath(): string {
    return this.suspiciousLogPath;
  }

  /**
   * Set security level
   */
  public setSecurityLevel(level: SecurityLevel): void {
    this.securityLevel = level;
    logger.puppeteer('info', `Security level set to: ${level}`);
  }
}
