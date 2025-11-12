import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { ScrapingConfig, DataExtractor, ScrapedData, LogMessage, ExportFormat } from '../types/types';
import { CookieHandler } from './cookieHandler';
import { ElementPicker } from './elementPicker';
import { DiscordRpcService } from './discordRpc';
import { NetworkSecurityMonitor, SecurityLevel } from './NetworkSecurityMonitor';
import { logger } from './Logger';
import { SystemInfoDetector } from './systemInfo';
import { SessionManager } from './sessionManager';

// Configure puppeteer-extra with plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({
  blockTrackers: true,
  blockTrackersAndAnnoyances: true,  // Also blocks cookie notices and annoyances
  useCache: false  // Always fetch latest blocklists
}));

// Constants for timeouts and delays
const SCROLL_DELAY_MS = 300;
const SCROLL_DISTANCE_PX = 300;
const MAX_SCROLL_TIME_MS = 60000; // 60 seconds
const OVERLAY_FADE_DURATION_MS = 300;
const COOKIE_WAIT_MS = 1000;
const POST_SCROLL_WAIT_MS = 500;
const PICKER_PREP_WAIT_MS = 300;
const PAGE_NAVIGATION_TIMEOUT_MS = 30000;
const PAGE_EVALUATE_TIMEOUT_MS = 30000; // 30 seconds for evaluate calls
const MAX_SELECTOR_LENGTH = 500;
const MAX_FILENAME_LENGTH = 255;

export class Scraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cookieHandler: CookieHandler | null = null;
  private networkMonitor: NetworkSecurityMonitor | null = null;
  private logCallback: ((log: LogMessage) => void) | null = null;
  private dataCallback: ((data: ScrapedData) => void) | null = null;
  private discordRpc: DiscordRpcService | null = null;
  private securityLevel: SecurityLevel = 'normal';
  private sessionManager: SessionManager | null = null;

  constructor(
    logCallback?: (log: LogMessage) => void,
    dataCallback?: (data: ScrapedData) => void,
    discordRpc?: DiscordRpcService,
    sessionManager?: SessionManager
  ) {
    this.logCallback = logCallback || null;
    this.dataCallback = dataCallback || null;
    this.discordRpc = discordRpc || null;
    this.sessionManager = sessionManager || null;
  }

  private log(level: LogMessage['level'], message: string): void {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    if (this.logCallback) {
      this.logCallback(logMessage);
    }

    // Use proper logger with Browse4Extract category instead of console.log
    logger.browse4extract(level as any, message);
  }

  async initialize(debugMode: boolean, showWatermark: boolean = false): Promise<void> {
    try {
      this.log('info', 'Initializing Puppeteer with stealth mode and ad blocker...');

      // Detect real system information for consistent fingerprinting
      const systemInfo = SystemInfoDetector.getSystemInfo();
      this.log('info', `System detected: ${systemInfo.platform}, ${systemInfo.cpuCores} cores, ${systemInfo.deviceMemory}GB RAM, [${systemInfo.languages.join(', ')}]`);

      this.browser = await puppeteer.launch({
        headless: !debugMode,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled', // Additional anti-detection
          '--start-maximized', // Start maximized
          '--force-dark-mode', // Enable dark mode
          '--disable-infobars', // Disable Chrome infobars
          '--disable-default-apps' // Disable default apps
        ]
      });

      this.page = await this.browser.newPage();

      // SECURITY: Set default timeout for all page operations including evaluate()
      this.page.setDefaultTimeout(PAGE_EVALUATE_TIMEOUT_MS);
      this.page.setDefaultNavigationTimeout(PAGE_NAVIGATION_TIMEOUT_MS);

      // Set viewport to maximum screen size (Full HD)
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Emulate dark mode preference
      await this.page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'dark' }
      ]);

      // Initialize cookie handler
      this.cookieHandler = new CookieHandler(this.page);

      // Initialize network security monitor
      this.networkMonitor = new NetworkSecurityMonitor(this.page, this.securityLevel);
      await this.networkMonitor.initialize();
      logger.puppeteer('info', 'Network security monitor enabled');

      // Use system-based user agent (rotating between recent Chrome versions, but matching real OS)
      const userAgentVariations = SystemInfoDetector.getUserAgentVariations();
      const selectedUA = userAgentVariations[Math.floor(Math.random() * userAgentVariations.length)];
      await this.page.setUserAgent(selectedUA);
      this.log('info', `Using system-matched UA: Chrome/${selectedUA.match(/Chrome\/([^ ]+)/)?.[1]}`);

      // Enhanced anti-detection: Use REAL system properties for consistent fingerprint
      await this.page.evaluateOnNewDocument((sysInfo) => {
        // Spoof with REAL system values to avoid detection inconsistencies
        Object.defineProperty(navigator, 'languages', {
          get: () => sysInfo.languages
        });

        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => sysInfo.cpuCores
        });

        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => sysInfo.deviceMemory
        });

        Object.defineProperty(navigator, 'platform', {
          get: () => sysInfo.platform
        });

        Object.defineProperty(navigator, 'maxTouchPoints', {
          get: () => 0 // Desktop has no touch support
        });
      }, systemInfo);

      // Optionally inject Browse4Extract watermark on every page load
      // Note: Watermark is disabled by default to reduce detection risk via DOM inspection
      if (showWatermark) {
        this.log('info', 'Watermark enabled (may increase detection risk)');
        await this.page.evaluateOnNewDocument(() => {
          // Wait for DOM to be ready
          const injectWatermark = () => {
            // Check if watermark already exists
            if (document.getElementById('browse4extract-watermark')) {
              return;
            }

            const watermark = document.createElement('div');
            watermark.id = 'browse4extract-watermark';
            watermark.textContent = 'Browse4Extract';
            watermark.style.cssText = `
              position: fixed;
              bottom: 10px;
              right: 10px;
              background: linear-gradient(135deg, #6fbb69 0%, #bf8fd7 100%);
              color: white;
              padding: 5px 12px;
              border-radius: 6px;
              font-family: Arial, sans-serif;
              font-size: 11px;
              font-weight: bold;
              z-index: 999997;
              opacity: 0.7;
              pointer-events: none;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            `;

            // Append to body when available
            if (document.body) {
              document.body.appendChild(watermark);
            } else {
              // If body not ready, wait for it
              document.addEventListener('DOMContentLoaded', () => {
                if (document.body && !document.getElementById('browse4extract-watermark')) {
                  document.body.appendChild(watermark);
                }
              });
            }
          };

          // Try to inject immediately
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectWatermark);
          } else {
            injectWatermark();
          }
        });
      }

      this.log('success', 'Puppeteer initialized successfully with obstacle handling');
    } catch (error) {
      this.log('error', `Initialization error: ${error}`);
      throw error;
    }
  }

  /**
   * Auto-scroll the entire page to load lazy-loaded content
   * @param scrollDelay Delay between scroll steps in ms
   */
  /**
   * Show auto-scroll banner (similar to ESC banner in element picker)
   */
  private async showAutoScrollBanner(): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate(() => {
      // Remove existing banner if present
      const existing = document.getElementById('browse4extract-autoscroll-banner');
      if (existing) {
        existing.remove();
      }

      // Create banner
      const banner = document.createElement('div');
      banner.id = 'browse4extract-autoscroll-banner';
      banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #6fbb69 0%, #bf8fd7 100%);
        color: #fff;
        padding: 12px 24px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 16px rgba(0,0,0,0.6);
        z-index: 1000000;
        pointer-events: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
      `;
      banner.textContent = '⏳ Loading all elements, please wait...';
      document.body.appendChild(banner);
    });
  }

  /**
   * Remove auto-scroll banner
   */
  private async removeAutoScrollBanner(): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate(() => {
      const banner = document.getElementById('browse4extract-autoscroll-banner');
      if (banner) {
        banner.remove();
      }
    });
  }

  private async autoScroll(scrollDelay: number = SCROLL_DELAY_MS): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    this.log('info', 'Auto-scrolling page to load lazy content...');

    // Show banner before starting scroll
    await this.showAutoScrollBanner();

    await this.page.evaluate(async (delay: number) => {
      // Save initial scroll position and overflow state
      const initialScrollX = window.scrollX;
      const initialScrollY = window.scrollY;
      const bodyOverflow = document.body.style.overflow;
      const htmlOverflow = document.documentElement.style.overflow;

      // SECURITY: Maximum scroll time to prevent infinite loops on infinite-scroll pages
      const startTime = Date.now();

      await new Promise<void>((resolve) => {
        let totalHeight = 0;

        const timer = setInterval(() => {
          // Check timeout first
          if (Date.now() - startTime > MAX_SCROLL_TIME_MS) {
            clearInterval(timer);

            // Restore original scroll position
            window.scrollTo(initialScrollX, initialScrollY);

            // Restore original overflow properties
            document.body.style.overflow = bodyOverflow;
            document.documentElement.style.overflow = htmlOverflow;

            resolve();
            return;
          }

          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, SCROLL_DISTANCE_PX);
          totalHeight += SCROLL_DISTANCE_PX;

          // Check if we've reached the bottom
          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);

            // Restore original scroll position
            window.scrollTo(initialScrollX, initialScrollY);

            // Restore original overflow properties
            document.body.style.overflow = bodyOverflow;
            document.documentElement.style.overflow = htmlOverflow;

            resolve();
          }
        }, delay);
      });
    }, scrollDelay);

    // Remove banner after scroll completes
    await this.removeAutoScrollBanner();

    this.log('success', 'Auto-scroll completed, scroll state restored');
  }

  /**
   * Inject loading overlay with spinner and message
   */
  private async injectLoadingOverlay(message: string): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate((msg: string) => {
      // Remove existing overlay if present
      const existing = document.getElementById('browse4extract-loading');
      if (existing) existing.remove();

      // Create overlay (using safe DOM manipulation instead of innerHTML)
      const overlay = document.createElement('div');
      overlay.id = 'browse4extract-loading';

      const container = document.createElement('div');
      container.className = 'spinner-container';

      const spinner = document.createElement('div');
      spinner.className = 'spinner';

      const text = document.createElement('div');
      text.className = 'loading-text';
      text.textContent = msg; // Safe - textContent auto-escapes

      container.appendChild(spinner);
      container.appendChild(text);
      overlay.appendChild(container);

      // Styles CSS inline
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.85); z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        cursor: wait;
      `;

      // Apply styles to created elements
      container.style.cssText = 'text-align: center;';

      spinner.style.cssText = `
        width: 60px; height: 60px; margin: 0 auto 20px;
        border: 4px solid rgba(111, 187, 105, 0.3);
        border-top-color: #6fbb69; border-radius: 50%;
        animation: browse4extract-spin 1s linear infinite;
      `;

      text.style.cssText = `
        color: #ffffff; font-size: 16px; font-weight: 500;
        margin-bottom: 10px;
      `;

      // Keyframes for animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes browse4extract-spin {
          to { transform: rotate(360deg); }
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(overlay);
    }, message);
  }

  /**
   * Update loading overlay message
   */
  private async updateLoadingMessage(message: string): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate((msg: string) => {
      const text = document.querySelector('#browse4extract-loading .loading-text') as HTMLElement;
      if (text) text.textContent = msg;
    }, message);
  }

  /**
   * Remove loading overlay with fade-out animation
   */
  private async removeLoadingOverlay(): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate(() => {
      const overlay = document.getElementById('browse4extract-loading');
      if (overlay) {
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), OVERLAY_FADE_DURATION_MS);
      }
    });
  }

  async navigateToUrl(url: string, handleObstacles: boolean = true, skipAutoScroll: boolean = false): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    // Validate URL format
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
      }
    } catch (error) {
      throw new Error(`Invalid URL format: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      this.log('info', `Navigating to ${url}...`);
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: PAGE_NAVIGATION_TIMEOUT_MS });
      this.log('success', 'Page loaded successfully');

      // Handle obstacles (cookies, modals, ads) if enabled
      if (handleObstacles && this.cookieHandler) {
        this.log('info', 'Handling obstacles (cookies, popups, ads)...');
        const result = await this.cookieHandler.handleAllObstacles();

        if (result.success) {
          if (result.dismissed > 0) {
            this.log('success', `Successfully dismissed ${result.dismissed} obstacle(s)`);
          } else {
            this.log('info', 'No obstacles detected');
          }
        } else {
          this.log('warning', 'Some obstacles could not be handled automatically');
        }

        // Wait a bit for the page to stabilize after obstacle handling
        await new Promise(resolve => setTimeout(resolve, COOKIE_WAIT_MS));
      }

      // Auto-scroll to load all lazy content (skip for element picker to improve performance)
      if (!skipAutoScroll) {
        await this.autoScroll();

        // Wait for any final animations/loading
        await new Promise(resolve => setTimeout(resolve, POST_SCROLL_WAIT_MS));
      } else {
        this.log('info', 'Skipping auto-scroll for faster element selection');
      }

    } catch (error) {
      this.log('error', `Navigation error: ${error}`);
      throw error;
    }
  }

  async extractData(extractors: DataExtractor[], domain?: string): Promise<ScrapedData[]> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const results: ScrapedData[] = [];

    try {
      this.log('info', `Extracting data with ${extractors.length} extractors...`);

      // Find all elements matching the first selector to determine item count
      const firstSelector = extractors[0]?.selector;
      if (!firstSelector) {
        this.log('warning', 'No extractors configured');
        return results;
      }

      const elementCount = await this.page.$$eval(firstSelector, (els) => els.length);
      this.log('info', `${elementCount} elements found for selector: ${firstSelector}`);

      // For each element, extract all configured data
      for (let i = 0; i < elementCount; i++) {
        const itemData: ScrapedData = {};

        for (const extractor of extractors) {
          try {
            const value = await this.extractSingleValue(extractor, i);
            itemData[extractor.fieldName] = value;
          } catch (error) {
            this.log('warning', `Error for field "${extractor.fieldName}" (index ${i}): ${error}`);
            itemData[extractor.fieldName] = null;
          }
        }

        results.push(itemData);

        if (this.dataCallback) {
          this.dataCallback(itemData);
        }

        // Update Discord RPC with current progress
        if (this.discordRpc && domain) {
          this.discordRpc.setScraping(domain, i + 1, elementCount);
        }

        this.log('info', `Element ${i + 1}/${elementCount} extracted`);
      }

      this.log('success', `${results.length} elements extracted successfully`);
      return results;
    } catch (error) {
      this.log('error', `Extraction error: ${error}`);
      throw error;
    }
  }

  /**
   * SECURITY: Validate CSS selector to prevent injection attacks
   */
  private validateSelector(selector: string): void {
    // Check selector length (prevent DoS via extremely long selectors)
    if (selector.length > MAX_SELECTOR_LENGTH) {
      throw new Error('Selector too long (max 500 characters)');
    }

    // Check for dangerous patterns that could indicate injection attempts
    if (selector.includes('<script') || selector.includes('javascript:')) {
      throw new Error('Invalid selector: dangerous pattern detected');
    }

    // Basic CSS selector format validation (allow common selectors)
    // This regex allows: IDs, classes, tags, attributes, combinators, pseudo-classes
    const validSelectorPattern = /^[a-zA-Z0-9\s\-_#.\[\]="':>+~*(),^$|]+$/;
    if (!validSelectorPattern.test(selector)) {
      throw new Error('Invalid selector format: contains illegal characters');
    }
  }

  private async extractSingleValue(extractor: DataExtractor, index: number): Promise<string | null> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const { selector, extractorType, attributeName } = extractor;

    // SECURITY: Validate selector before use
    this.validateSelector(selector);

    switch (extractorType) {
      case 'text':
        return await this.page.$$eval(
          selector,
          (els, idx) => {
            const el = els[idx];
            return el ? el.textContent?.trim() || null : null;
          },
          index
        );

      case 'attribute':
        if (!attributeName) {
          throw new Error('attributeName is required for attribute extractor');
        }
        return await this.page.$$eval(
          selector,
          (els, idx, attr) => {
            const el = els[idx];
            return el ? el.getAttribute(attr) : null;
          },
          index,
          attributeName
        );

      case 'child-link-url':
        return await this.page.$$eval(
          selector,
          (els, idx) => {
            const el = els[idx];
            if (!el) return null;
            const link = el.querySelector('a');
            return link ? link.getAttribute('href') : null;
          },
          index
        );

      case 'child-link-text':
        return await this.page.$$eval(
          selector,
          (els, idx) => {
            const el = els[idx];
            if (!el) return null;
            const link = el.querySelector('a');
            return link ? link.textContent?.trim() || null : null;
          },
          index
        );

      default:
        throw new Error(`Unknown extractor type: ${extractorType}`);
    }
  }

  private sanitizeFileName(fileName: string): string {
    // Remove path traversal attempts and dangerous characters
    return path.basename(fileName)
      .replace(/[<>:"|?*]/g, '_')
      .replace(/\.\./g, '_')
      .substring(0, MAX_FILENAME_LENGTH); // Limit filename length
  }

  private getOutputsPath(): string {
    const { app } = require('electron');
    const appPath = app.getPath('userData');
    const outputsPath = path.join(appPath, 'outputs');

    // Create outputs folder if it doesn't exist
    if (!fs.existsSync(outputsPath)) {
      fs.mkdirSync(outputsPath, { recursive: true });
    }

    return outputsPath;
  }

  async saveToJson(data: ScrapedData[], fileName: string): Promise<string> {
    try {
      const sanitized = this.sanitizeFileName(fileName);
      this.log('info', `Saving data to ${sanitized}...`);

      const outputsPath = this.getOutputsPath();
      const filePath = path.join(outputsPath, sanitized);

      const jsonContent = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonContent, 'utf-8');

      this.log('success', `File saved: ${filePath}`);
      return filePath;
    } catch (error) {
      this.log('error', `Save error: ${error}`);
      throw error;
    }
  }

  async saveToCsv(data: ScrapedData[], fileName: string): Promise<string> {
    try {
      const sanitized = this.sanitizeFileName(fileName);
      this.log('info', `Saving data to CSV ${sanitized}...`);

      const outputsPath = this.getOutputsPath();
      const filePath = path.join(outputsPath, sanitized);

      if (data.length === 0) {
        throw new Error('No data to export');
      }

      // Get headers from first element
      const headers = Object.keys(data[0]);

      // Create CSV content
      const csvRows: string[] = [];

      // Add header
      csvRows.push(headers.map(h => this.escapeCsvValue(h)).join(','));

      // Add data rows
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];
          return this.escapeCsvValue(value || '');
        });
        csvRows.push(values.join(','));
      }

      const csvContent = csvRows.join('\n');
      fs.writeFileSync(filePath, csvContent, 'utf-8');

      this.log('success', `CSV file saved: ${filePath}`);
      return filePath;
    } catch (error) {
      this.log('error', `CSV save error: ${error}`);
      throw error;
    }
  }

  private escapeCsvValue(value: string): string {
    // Escape CSV values (quotes and commas)
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  async saveToExcel(data: ScrapedData[], fileName: string): Promise<string> {
    try {
      const sanitized = this.sanitizeFileName(fileName);
      this.log('info', `Saving data to Excel ${sanitized}...`);

      const outputsPath = this.getOutputsPath();
      const filePath = path.join(outputsPath, sanitized);

      if (data.length === 0) {
        throw new Error('No data to export');
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Extracted Data');

      // Get headers
      const headers = Object.keys(data[0]);

      // Add headers with style
      worksheet.columns = headers.map(header => ({
        header: header,
        key: header,
        width: 20
      }));

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4FC3F7' }
      };

      // Add data
      data.forEach(row => {
        worksheet.addRow(row);
      });

      // Save file
      await workbook.xlsx.writeFile(filePath);

      this.log('success', `Excel file saved: ${filePath}`);
      return filePath;
    } catch (error) {
      this.log('error', `Excel save error: ${error}`);
      throw error;
    }
  }

  async saveData(data: ScrapedData[], fileName: string, format: ExportFormat = 'json'): Promise<string> {
    switch (format) {
      case 'csv':
        return await this.saveToCsv(data, fileName);
      case 'excel':
        return await this.saveToExcel(data, fileName);
      case 'json':
      default:
        return await this.saveToJson(data, fileName);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      this.log('info', 'Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.log('success', 'Browser closed');
    }
  }

  /**
   * Get the current page instance (for session management)
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Get the current browser instance (for session management)
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  async scrape(config: ScrapingConfig): Promise<ScrapedData[]> {
    try {
      await this.initialize(config.debugMode);

      // Load session if specified
      if (config.sessionProfileId && this.sessionManager && this.page) {
        this.log('info', `Loading session profile: ${config.sessionProfileId}...`);
        const success = await this.sessionManager.applySessionToPage(this.page, config.sessionProfileId);
        if (success) {
          this.log('success', 'Session loaded successfully');
        } else {
          this.log('warning', 'Failed to load session, continuing without it');
        }
      }

      // Handle obstacles by default unless explicitly disabled
      const handleObstacles = config.handleObstacles !== false;
      await this.navigateToUrl(config.url, handleObstacles);

      // Extract domain for Discord RPC
      const domain = new URL(config.url).hostname.replace(/^www\./, '');

      const data = await this.extractData(config.extractors, domain);

      if (data.length > 0) {
        const format = config.exportFormat || 'json';
        await this.saveData(data, config.fileName, format);

        // Update Discord RPC on completion
        if (this.discordRpc) {
          this.discordRpc.setCompleted(data.length, domain);
        }
      }

      return data;
    } finally {
      await this.close();
    }
  }

  async previewSelector(url: string, selector: string, extractorType: string, attributeName?: string): Promise<any> {
    try {
      this.log('info', 'Previewing selector...');

      await this.initialize(false);
      await this.navigateToUrl(url);

      const extractor: DataExtractor = {
        id: 'preview',
        fieldName: 'preview',
        selector,
        extractorType: extractorType as any,
        attributeName
      };

      // Get limited preview (max 5 elements)
      const elementCount = await this.page!.$$eval(selector, (els) => els.length);
      const previewCount = Math.min(elementCount, 5);

      const results = [];
      for (let i = 0; i < previewCount; i++) {
        const value = await this.extractSingleValue(extractor, i);
        results.push(value);
      }

      this.log('success', `Preview: ${elementCount} elements found, ${previewCount} shown`);

      return {
        success: true,
        totalCount: elementCount,
        previewCount,
        samples: results
      };
    } catch (error) {
      this.log('error', `Preview error: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      await this.close();
    }
  }

  /**
   * Opens Visual Element Picker to select an element interactively
   * @param url URL to navigate to
   * @param sessionProfileId Optional session profile ID to load cookies/auth
   * @returns Selected element information including optimal selector
   */
  async pickElement(url: string, sessionProfileId?: string): Promise<any> {
    try {
      this.log('info', 'Starting Visual Element Picker...');

      await this.initialize(true); // Always visible for picking

      if (!this.page) {
        throw new Error('Page not initialized');
      }

      // Load session if provided or try to find by domain
      if (sessionProfileId && this.sessionManager) {
        this.log('info', `Loading session profile: ${sessionProfileId}...`);
        const success = await this.sessionManager.applySessionToPage(this.page, sessionProfileId);
        if (success) {
          this.log('success', 'Session loaded successfully for element picker');
        } else {
          this.log('warning', 'Failed to load session, continuing without authentication');
        }
      } else if (this.sessionManager) {
        // Try to find session by domain
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname;
          this.log('info', `Looking for session matching domain: ${domain}...`);
          const session = await this.sessionManager.findSessionByDomain(domain);
          if (session) {
            this.log('info', `Found session "${session.name}" for domain, applying...`);
            const success = await this.sessionManager.applySessionToPage(this.page, session.id);
            if (success) {
              this.log('success', 'Session auto-loaded by domain match');
            }
          } else {
            this.log('info', 'No session found for this domain');
          }
        } catch (error) {
          this.log('warning', `Could not auto-detect session: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Navigate to URL
      this.log('info', `Navigating to ${url}...`);

      // Validate URL (SECURITY: Prevent SSRF attacks)
      try {
        const urlObj = new URL(url);

        // Only allow HTTP and HTTPS protocols
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error('Only HTTP and HTTPS protocols are allowed');
        }

        // Block localhost and loopback IPs
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
        if (blockedHosts.includes(urlObj.hostname.toLowerCase())) {
          throw new Error('Cannot access localhost or internal networks');
        }

        // Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
        const ipMatch = urlObj.hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (ipMatch) {
          const [, a, b] = ipMatch.map(Number);
          if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
            throw new Error('Cannot access private IP ranges');
          }
          // Block link-local addresses (169.254.x.x)
          if (a === 169 && b === 254) {
            throw new Error('Cannot access link-local addresses');
          }
        }
      } catch (error) {
        throw new Error(`Invalid URL format: ${error instanceof Error ? error.message : String(error)}`);
      }

      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: PAGE_NAVIGATION_TIMEOUT_MS });
      this.log('success', 'Page loaded successfully');

      // Inject loading overlay AFTER navigation
      await this.injectLoadingOverlay('Handling cookies and popups...');

      // Handle obstacles (cookies, modals, ads)
      if (this.cookieHandler) {
        this.log('info', 'Handling obstacles (cookies, popups, ads)...');
        const result = await this.cookieHandler.handleAllObstacles();

        if (result.success) {
          if (result.dismissed > 0) {
            this.log('success', `Successfully dismissed ${result.dismissed} obstacle(s)`);
          } else {
            this.log('info', 'No obstacles detected');
          }
        } else {
          this.log('warning', 'Some obstacles could not be handled automatically');
        }

        // Wait for page to stabilize
        await new Promise(resolve => setTimeout(resolve, COOKIE_WAIT_MS));
      }

      // Auto-scroll to load lazy content
      await this.updateLoadingMessage('Loading lazy content...');
      await this.autoScroll();
      await new Promise(resolve => setTimeout(resolve, POST_SCROLL_WAIT_MS));

      // Preparing picker
      await this.updateLoadingMessage('Preparing element picker...');
      await new Promise(resolve => setTimeout(resolve, PICKER_PREP_WAIT_MS));

      // Overlay will be removed by ElementPicker just before showing picker UI
      const picker = new ElementPicker(this.page!);
      this.log('info', 'Visual Picker ready - click on an element to select it (ESC to cancel)');

      const selectedElement = await picker.pickElement();

      this.log('success', `Element selected: ${selectedElement.selector}`);

      // Close browser after successful selection
      this.log('info', 'Closing browser...');
      await this.close();

      return {
        success: true,
        element: selectedElement
      };
    } catch (error) {
      this.log('error', `Visual Picker error: ${error}`);

      // Remove overlay on error
      try {
        await this.removeLoadingOverlay();
      } catch (e) {
        // Ignore overlay removal errors
      }

      // Close browser on error
      await this.close();

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

