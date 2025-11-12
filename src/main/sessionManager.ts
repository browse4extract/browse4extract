import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { SessionProfile, SessionCreationResult } from '../types/types';
import { logger } from './Logger';
import { Browser, Page } from 'puppeteer';

/**
 * SessionManager - Manages authentication sessions with cookie persistence
 *
 * Features:
 * - Save/load cookies between sessions
 * - Encrypt sensitive session data with Electron's safeStorage
 * - Support for localStorage and sessionStorage
 * - Session validation and testing
 * - Domain-based session management
 */
export class SessionManager {
  private sessionsPath: string;
  private activePage: Page | null = null;

  constructor() {
    // Store sessions in userData/sessions
    this.sessionsPath = path.join(app.getPath('userData'), 'sessions');
    this.ensureSessionsDirectory();
  }

  /**
   * Ensure the sessions directory exists
   */
  private ensureSessionsDirectory(): void {
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
      logger.info('Browse4Extract', 'Sessions directory created');
    }
  }

  /**
   * Get the file path for a session
   * Sanitizes sessionId to prevent path traversal attacks
   */
  private getSessionFilePath(sessionId: string): string {
    // Remove path traversal attempts and dangerous characters
    const sanitized = sessionId.replace(/[\/\\\.]/g, '_');
    if (sanitized.length === 0 || sanitized.length > 255) {
      throw new Error('Invalid session ID');
    }
    return path.join(this.sessionsPath, `${sanitized}.session`);
  }

  /**
   * Encrypt session data using Electron's safeStorage
   * Returns null if encryption is not available - will not fall back to plaintext
   */
  private encryptSessionData(data: SessionProfile): Buffer | null {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        logger.error('Browse4Extract', 'Encryption not available. Cannot store session securely.');
        return null;
      }

      const jsonData = JSON.stringify(data);
      return safeStorage.encryptString(jsonData);
    } catch (error) {
      logger.error('Browse4Extract', `Failed to encrypt session data: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Decrypt session data using Electron's safeStorage
   */
  private decryptSessionData(buffer: Buffer): SessionProfile | null {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        // Data was stored without encryption
        const jsonData = buffer.toString();
        return JSON.parse(jsonData);
      }

      const decrypted = safeStorage.decryptString(buffer);
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Browse4Extract', `Failed to decrypt session data: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Save a session profile to disk
   */
  async saveSession(profile: SessionProfile): Promise<SessionCreationResult> {
    try {
      // Check session data size before encryption
      const jsonData = JSON.stringify(profile);
      const MAX_SESSION_SIZE = 10 * 1024 * 1024; // 10MB
      if (jsonData.length > MAX_SESSION_SIZE) {
        logger.error('Browse4Extract', 'Session data too large');
        return {
          success: false,
          error: 'Session data exceeds maximum size limit (10MB)'
        };
      }

      const encrypted = this.encryptSessionData(profile);
      if (!encrypted) {
        return {
          success: false,
          error: 'Encryption is not available on this system. Cannot save session securely.'
        };
      }

      const filePath = this.getSessionFilePath(profile.id);
      fs.writeFileSync(filePath, encrypted);

      logger.info('Browse4Extract', `Session "${profile.name}" saved successfully`);

      return {
        success: true,
        profile
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Browse4Extract', `Failed to save session: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Load a session profile from disk
   */
  async loadSession(sessionId: string): Promise<SessionProfile | null> {
    try {
      const filePath = this.getSessionFilePath(sessionId);

      if (!fs.existsSync(filePath)) {
        logger.warning('Browse4Extract', `Session file not found: ${sessionId}`);
        return null;
      }

      const encrypted = fs.readFileSync(filePath);
      const profile = this.decryptSessionData(encrypted);

      if (!profile) {
        return null;
      }

      // Update last used timestamp
      profile.lastUsed = new Date().toISOString();
      await this.saveSession(profile);

      logger.info('Browse4Extract', `Session "${profile.name}" loaded successfully`);
      return profile;
    } catch (error) {
      logger.error('Browse4Extract', `Failed to load session: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * List all saved sessions
   */
  async listSessions(): Promise<SessionProfile[]> {
    try {
      const files = fs.readdirSync(this.sessionsPath);
      const sessions: SessionProfile[] = [];

      for (const file of files) {
        if (file.endsWith('.session')) {
          const sessionId = file.replace('.session', '');
          const session = await this.loadSession(sessionId);
          if (session) {
            sessions.push(session);
          }
        }
      }

      // Sort by last used (most recent first)
      sessions.sort((a, b) => {
        const dateA = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
        const dateB = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
        return dateB - dateA;
      });

      return sessions;
    } catch (error) {
      logger.error('Browse4Extract', `Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Delete a session profile
   */
  async deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filePath = this.getSessionFilePath(sessionId);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      fs.unlinkSync(filePath);
      logger.info('Browse4Extract', `Session deleted: ${sessionId}`);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Browse4Extract', `Failed to delete session: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Load session cookies and storage into a Puppeteer page
   */
  async applySessionToPage(page: Page, sessionId: string): Promise<boolean> {
    try {
      const session = await this.loadSession(sessionId);
      if (!session) {
        logger.error('Browse4Extract', `Session not found: ${sessionId}`);
        return false;
      }

      // Set cookies
      if (session.cookies && session.cookies.length > 0) {
        await page.setCookie(...session.cookies);
        logger.info('Browse4Extract', `Applied ${session.cookies.length} cookies from session "${session.name}"`);
      }

      // Set localStorage with validation
      if (session.localStorage && Object.keys(session.localStorage).length > 0) {
        await page.evaluateOnNewDocument((storage) => {
          for (const [key, value] of Object.entries(storage)) {
            try {
              // Validate that value is a string and not too large
              if (typeof value === 'string' && value.length < 100000) {
                localStorage.setItem(key, value);
              }
            } catch (e) {
              console.error('Failed to set localStorage item:', e);
            }
          }
        }, session.localStorage);
        logger.info('Browse4Extract', `Applied localStorage from session "${session.name}"`);
      }

      // Set sessionStorage with validation
      if (session.sessionStorage && Object.keys(session.sessionStorage).length > 0) {
        await page.evaluateOnNewDocument((storage) => {
          for (const [key, value] of Object.entries(storage)) {
            try {
              // Validate that value is a string and not too large
              if (typeof value === 'string' && value.length < 100000) {
                sessionStorage.setItem(key, value);
              }
            } catch (e) {
              console.error('Failed to set sessionStorage item:', e);
            }
          }
        }, session.sessionStorage);
        logger.info('Browse4Extract', `Applied sessionStorage from session "${session.name}"`);
      }

      logger.success('Browse4Extract', `Session "${session.name}" applied successfully`);
      return true;
    } catch (error) {
      logger.error('Browse4Extract', `Failed to apply session: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Capture current session from a Puppeteer page
   */
  async captureSessionFromPage(page: Page, sessionId: string, name: string, domain: string, loginUrl?: string): Promise<SessionCreationResult> {
    try {
      // Get cookies
      const cookies = await page.cookies();

      // Get localStorage
      const localStorage = await page.evaluate(() => {
        const storage: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            storage[key] = window.localStorage.getItem(key) || '';
          }
        }
        return storage;
      });

      // Get sessionStorage
      const sessionStorage = await page.evaluate(() => {
        const storage: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            storage[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return storage;
      });

      const profile: SessionProfile = {
        id: sessionId,
        name,
        domain,
        loginUrl,
        cookies,
        localStorage,
        sessionStorage,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      };

      return await this.saveSession(profile);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Browse4Extract', `Failed to capture session: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Set the active browser and page for session management
   */
  setActiveBrowserPage(_browser: Browser | null, page: Page | null): void {
    this.activePage = page;
  }

  /**
   * Get the active page (used for capturing session)
   */
  getActivePage(): Page | null {
    return this.activePage;
  }

  /**
   * Clear active browser reference
   */
  clearActiveBrowser(): void {
    this.activePage = null;
  }

  /**
   * Test if a session is still valid
   */
  async testSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = await this.loadSession(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      // Basic validation: check if cookies exist
      if (!session.cookies || session.cookies.length === 0) {
        return {
          success: false,
          error: 'Session has no cookies'
        };
      }

      // Check if cookies are expired
      const now = Date.now() / 1000;
      const expiredCookies = session.cookies.filter(cookie => {
        if (cookie.expires && cookie.expires > 0) {
          return cookie.expires < now;
        }
        return false;
      });

      if (expiredCookies.length === session.cookies.length) {
        return {
          success: false,
          error: 'All session cookies have expired'
        };
      }

      logger.success('Browse4Extract', `Session "${session.name}" is valid`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Browse4Extract', `Failed to test session: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Find session by domain
   */
  async findSessionByDomain(domain: string): Promise<SessionProfile | null> {
    const sessions = await this.listSessions();
    return sessions.find(s => s.domain === domain) || null;
  }
}
