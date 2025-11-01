import { Page } from 'puppeteer';

/**
 * Cookie banner and modal auto-dismiss handler
 * Detects and automatically closes common cookie consent banners, popups, and modals
 */
export class CookieHandler {
  private page: Page;

  // Common selectors for cookie consent buttons (Accept/Refuse)
  private readonly cookieSelectors = [
    // Generic English by ID/Class patterns
    'button[id*="accept"]',
    'button[id*="Accept"]',
    'button[class*="accept"]',
    'button[class*="Accept"]',
    'button[id*="cookie"]',
    'button[id*="Cookie"]',
    'button[class*="cookie"]',
    'button[class*="Cookie"]',
    'button[id*="agree"]',
    'button[class*="agree"]',
    'a[id*="accept"]',
    'a[id*="Accept"]',
    'a[class*="accept"]',
    'a[class*="Accept"]',
    '[aria-label*="Accept"]',
    '[aria-label*="accept"]',
    '[aria-label*="agree"]',
    '[aria-label*="Agree"]',

    // Generic French by ID/Class patterns
    'button[id*="accepter"]',
    'button[id*="Accepter"]',
    'button[class*="accepter"]',
    'button[class*="Accepter"]',
    '[aria-label*="Accepter"]',
    '[aria-label*="accepter"]',

    // Specific cookie consent tools
    '#onetrust-accept-btn-handler',
    '.onetrust-close-btn-handler',
    '#cookie-consent-accept',
    '.cookie-consent-accept',
    '.js-cookie-accept',
    '#didomi-notice-agree-button',
    '.didomi-button',
    '.didomi-continue-without-agreeing',
    '.sp_choice_type_11', // Sourcepoint
    '.sp_choice_type_12',
    '.message-component.message-button',
    '#acceptAllButton',
    '.accept-all',
    '.accept-all-cookies',
    '.acceptAll',
    '.consent-accept',
    '.cookie-accept',
    '.cookies-accept',

    // CMP (Consent Management Platform) specific
    '.fc-cta-consent', // Findomestic
    '.fc-button-label',
    '[data-testid="uc-accept-all-button"]', // Usercentrics
    '.sc-button-accept',
    '.qc-cmp2-summary-buttons > button:first-child', // Quantcast

    // Common button classes
    'button.btn-accept',
    'button.btn-consent',
    'a.btn-accept',
    'a.btn-consent',
  ];

  // Selectors for modal close buttons
  private readonly modalCloseSelectors = [
    'button[aria-label="Close"]',
    'button[aria-label="close"]',
    'button.modal-close',
    'button.close',
    '.modal-close-button',
    '[class*="close-button"]',
    '[class*="modal-close"]',
    'button[title="Close"]',
    'button[title="close"]',
  ];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Attempts to dismiss cookie banners and modals
   * @param maxAttempts Maximum number of attempts to find and click elements
   * @returns Number of elements dismissed
   */
  async dismissObstacles(maxAttempts: number = 3): Promise<number> {
    let dismissedCount = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait a bit for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try to dismiss cookie banners by selector
      const cookieDismissed = await this.tryDismissElements(this.cookieSelectors);
      dismissedCount += cookieDismissed;

      // Try to dismiss by text content (fallback)
      const textDismissed = await this.tryDismissByText();
      dismissedCount += textDismissed;

      // Try to close modals
      const modalsDismissed = await this.tryDismissElements(this.modalCloseSelectors);
      dismissedCount += modalsDismissed;

      // If nothing was dismissed in this attempt, we can stop
      if (cookieDismissed === 0 && modalsDismissed === 0 && textDismissed === 0) {
        break;
      }

      // Wait for animations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return dismissedCount;
  }

  /**
   * Tries to dismiss cookie banners by searching for common text patterns
   * @returns Number of elements successfully clicked
   */
  private async tryDismissByText(): Promise<number> {
    try {
      // Common text patterns for accept/agree buttons (case-insensitive)
      const textPatterns = [
        // English
        /^accept$/i,
        /^accept all$/i,
        /^i accept$/i,
        /^agree$/i,
        /^i agree$/i,
        /^ok$/i,
        /^got it$/i,
        /^allow all$/i,
        /^continue$/i,
        // French
        /^accepter$/i,
        /^j'accepte$/i,
        /^d'accord$/i,
        /^tout accepter$/i,
        /^autoriser$/i,
        /^continuer$/i,
      ];

      const clicked = await this.page.evaluate((patterns: string[]) => {
        let clickCount = 0;

        // Convert string patterns back to RegExp
        const regexPatterns = patterns.map(p => new RegExp(p.slice(1, -1), p.slice(-1)));

        // Find all buttons and links
        const elements = document.querySelectorAll('button, a, [role="button"]');

        for (const el of Array.from(elements)) {
          const text = (el.textContent || '').trim();

          // Check if text matches any pattern
          if (regexPatterns.some(pattern => pattern.test(text))) {
            // Check if element is visible
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0) {
              // Click the element
              (el as HTMLElement).click();
              clickCount++;
              console.log(`[CookieHandler] Clicked button with text: "${text}"`);
              break; // Click only the first match
            }
          }
        }

        return clickCount;
      }, textPatterns.map(p => p.toString()));

      if (clicked > 0) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      return clicked;
    } catch (error) {
      console.error('[CookieHandler] Error in tryDismissByText:', error);
      return 0;
    }
  }

  /**
   * Tries to find and click elements matching the provided selectors
   * @param selectors Array of CSS selectors to try
   * @returns Number of elements successfully clicked
   */
  private async tryDismissElements(selectors: string[]): Promise<number> {
    let clickedCount = 0;

    for (const selector of selectors) {
      try {
        // Check if element exists and is visible
        const element = await this.page.$(selector);

        if (element) {
          // Check visibility using boundingBox (returns null if not visible)
          const boundingBox = await element.boundingBox();

          if (boundingBox) {
            // Element is visible, try to click it
            await element.click({ delay: 100 });
            clickedCount++;

            // Wait a bit after clicking
            await new Promise(resolve => setTimeout(resolve, 300));

            console.log(`[CookieHandler] Successfully clicked: ${selector}`);
          }
        }
      } catch (error) {
        // Silently continue - element might not exist or not be clickable
        continue;
      }
    }

    return clickedCount;
  }

  /**
   * Removes overlay elements that might block interaction
   * Useful for sticky banners or overlays that remain after dismissal
   */
  async removeOverlays(): Promise<void> {
    await this.page.evaluate(() => {
      // Common overlay class patterns
      const overlaySelectors = [
        '[class*="overlay"]',
        '[class*="modal-backdrop"]',
        '[id*="overlay"]',
        '[style*="position: fixed"]',
        '[style*="z-index: 9"]',
      ];

      overlaySelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const htmlEl = el as HTMLElement;
          // Check if it covers a significant portion of the screen
          const rect = htmlEl.getBoundingClientRect();
          if (rect.width > window.innerWidth * 0.5 || rect.height > window.innerHeight * 0.5) {
            htmlEl.style.display = 'none';
          }
        });
      });
    });
  }

  /**
   * Comprehensive obstacle handling:
   * 1. Dismiss cookie banners and modals
   * 2. Remove persistent overlays
   * 3. Wait for page to stabilize
   */
  async handleAllObstacles(): Promise<{ dismissed: number; success: boolean }> {
    try {
      // First pass: dismiss visible elements
      const dismissed = await this.dismissObstacles(3);

      // Wait for page to stabilize after dismissals
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Remove any remaining overlays
      await this.removeOverlays();

      // Final wait for animations
      await new Promise(resolve => setTimeout(resolve, 500));

      return { dismissed, success: true };
    } catch (error) {
      console.error('[CookieHandler] Error handling obstacles:', error);
      return { dismissed: 0, success: false };
    }
  }
}
