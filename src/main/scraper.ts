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

// Configure puppeteer-extra with plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

export class Scraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cookieHandler: CookieHandler | null = null;
  private logCallback: ((log: LogMessage) => void) | null = null;
  private dataCallback: ((data: ScrapedData) => void) | null = null;
  private discordRpc: DiscordRpcService | null = null;

  constructor(
    logCallback?: (log: LogMessage) => void,
    dataCallback?: (data: ScrapedData) => void,
    discordRpc?: DiscordRpcService
  ) {
    this.logCallback = logCallback || null;
    this.dataCallback = dataCallback || null;
    this.discordRpc = discordRpc || null;
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
    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  async initialize(debugMode: boolean): Promise<void> {
    try {
      this.log('info', 'Initializing Puppeteer with stealth mode and ad blocker...');

      this.browser = await puppeteer.launch({
        headless: !debugMode,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled', // Additional anti-detection
          '--start-maximized', // Start maximized
          '--force-dark-mode' // Enable dark mode
        ]
      });

      this.page = await this.browser.newPage();

      // Set viewport to maximum screen size (Full HD)
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Emulate dark mode preference
      await this.page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'dark' }
      ]);

      // Initialize cookie handler
      this.cookieHandler = new CookieHandler(this.page);

      // Set a realistic and up-to-date user agent (Chrome 131 - January 2025)
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      );

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
  private async autoScroll(scrollDelay: number = 300): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    this.log('info', 'Auto-scrolling page to load lazy content...');

    await this.page.evaluate(async (delay: number) => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 300; // Pixels to scroll each step

        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          // Check if we've reached the bottom
          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            // Scroll back to top
            window.scrollTo(0, 0);
            resolve();
          }
        }, delay);
      });
    }, scrollDelay);

    this.log('success', 'Auto-scroll completed, all lazy content loaded');
  }

  async navigateToUrl(url: string, handleObstacles: boolean = true): Promise<void> {
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
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
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
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Auto-scroll to load all lazy content
      await this.autoScroll();

      // Wait for any final animations/loading
      await new Promise(resolve => setTimeout(resolve, 500));

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

  private async extractSingleValue(extractor: DataExtractor, index: number): Promise<string | null> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const { selector, extractorType, attributeName } = extractor;

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
      .substring(0, 255); // Limit filename length
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

  async scrape(config: ScrapingConfig): Promise<ScrapedData[]> {
    try {
      await this.initialize(config.debugMode);

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
   * @returns Selected element information including optimal selector
   */
  async pickElement(url: string): Promise<any> {
    try {
      this.log('info', 'Starting Visual Element Picker...');

      await this.initialize(true); // Always visible for picking
      await this.navigateToUrl(url);

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

      // Close browser on error too
      await this.close();

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

