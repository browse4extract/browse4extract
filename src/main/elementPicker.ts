import { Page } from 'puppeteer';
import { logger } from './Logger';

// Constants for overlay fade timing
const OVERLAY_FADE_DURATION_MS = 300;
const OVERLAY_FADE_WAIT_MS = 350;
const ELEMENT_CHECK_INTERVAL_MS = 100;

/**
 * Visual Element Picker
 * Injects an interactive overlay into the page to allow visual selection of elements
 */
export class ElementPicker {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Injects the element picker overlay into the page
   * @returns Promise that resolves with the selected element info
   */
  async pickElement(): Promise<{
    selector: string;
    xpath: string;
    tagName: string;
    className: string;
    id: string;
    text: string;
    suggestedExtractorType: string;
    suggestedAttribute?: string;
  }> {
    // CRITICAL: Enable request interception and block all navigations IMMEDIATELY
    await this.page.setRequestInterception(true);

    // Block navigation requests at network level
    const navigationBlocker = (request: any) => {
      // Skip if already handled by adblocker or security monitor
      if (request.isInterceptResolutionHandled()) {
        return;
      }

      // Allow only document requests for the current page
      if (request.isNavigationRequest() && request.frame() === this.page?.mainFrame()) {
        // Block navigation to different URLs
        if (request.url() !== this.page?.url()) {
          logger.puppeteer('info', `[ElementPicker] Blocked navigation to: ${request.url()}`);
          request.abort();
          return;
        }
      }
      // Allow all other requests (images, scripts, etc.)
      request.continue();
    };

    this.page.on('request', navigationBlocker);

    // Store reference to remove listener later
    (this.page as any).__navigationBlocker = navigationBlocker;

    // Remove loading overlay JUST BEFORE picker UI injection
    await this.page.evaluate(() => {
      const overlay = document.getElementById('browse4extract-loading');
      if (overlay) {
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), OVERLAY_FADE_DURATION_MS);
      }
    });

    // Wait for fade-out to complete
    await new Promise(resolve => setTimeout(resolve, OVERLAY_FADE_WAIT_MS));

    // SECURITY: Ensure cleanup happens even if errors occur
    try {
      // Inject the picker script into the page
      await this.page.evaluate(() => {
      // Remove any existing picker overlay
      const existingOverlay = document.getElementById('browse4extract-picker-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // Patterns to exclude consent/cookie elements from selection
      const excludedPatterns = {
        ids: [
          'onetrust-accept-btn-handler',
          'cookie-consent-accept',
          'didomi-notice-agree-button',
          'acceptAllButton',
          'browse4extract-picker-overlay',
          'browse4extract-banner',
          'browse4extract-highlight',
          'browse4extract-tooltip'
        ],
        classes: [
          'onetrust-close-btn-handler',
          'cookie-consent-accept',
          'js-cookie-accept',
          'didomi-button',
          'fc-cta-consent',
          'consent-accept',
          'cookie-accept',
          'accept-all',
          'acceptAll',
          'sp_choice_type_11',
          'sp_choice_type_12'
        ],
        ariaLabels: [
          'accept',
          'accepter',
          'agree',
          'close',
          'fermer'
        ]
      };

      // Helper function to check if element should be excluded
      const isExcludedElement = (el: Element): boolean => {
        // Check ID
        if (el.id && excludedPatterns.ids.some(id => el.id.includes(id))) {
          return true;
        }

        // Check classes
        const classes = Array.from(el.classList);
        if (classes.some(cls => excludedPatterns.classes.some(excluded => cls.includes(excluded)))) {
          return true;
        }

        // Check aria-label
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
        if (excludedPatterns.ariaLabels.some(label => ariaLabel.includes(label))) {
          return true;
        }

        // Check if element contains "cookie", "consent", "accept" in common attributes
        const text = (el.textContent || '').toLowerCase();
        const hasConsentKeywords = text.includes('cookie') || text.includes('consent') || text.includes('accept') || text.includes('accepter');

        // Only exclude if it's a button/link with consent keywords
        if (hasConsentKeywords && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button')) {
          return true;
        }

        return false;
      };

      // Store reference for excluded check
      (window as any).__browse4extract_isExcludedElement = isExcludedElement;

      // Create overlay container
      const overlay = document.createElement('div');
      overlay.id = 'browse4extract-picker-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
        pointer-events: none;
      `;

      // Create highlight box (FIXED position for scroll compatibility)
      const highlightBox = document.createElement('div');
      highlightBox.id = 'browse4extract-highlight';
      highlightBox.style.cssText = `
        position: fixed;
        border: 3px solid #6fbb69;
        background: rgba(111, 187, 105, 0.15);
        pointer-events: none;
        transition: all 0.1s ease;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
        z-index: 999998;
      `;

      // Create info tooltip
      const tooltip = document.createElement('div');
      tooltip.id = 'browse4extract-tooltip';
      tooltip.style.cssText = `
        position: absolute;
        background: #0a0a0a;
        color: #6fbb69;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        pointer-events: none;
        white-space: nowrap;
        max-width: 400px;
        overflow: hidden;
        text-overflow: ellipsis;
        border: 1px solid rgba(111, 187, 105, 0.3);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      `;

      // Create instructions banner
      const banner = document.createElement('div');
      banner.id = 'browse4extract-banner';
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
      banner.textContent = 'Click on any element to select it (ESC to cancel)';

      overlay.appendChild(highlightBox);
      overlay.appendChild(tooltip);
      document.body.appendChild(overlay);
      document.body.appendChild(banner);

      // Store selected element info
      (window as any).__browse4extract_selectedElement = null;

      // Mouse move handler - highlight element under cursor
      const handleMouseMove = (e: MouseEvent) => {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (!target || target.closest('#browse4extract-picker-overlay, #browse4extract-banner')) {
          return;
        }

        // Skip excluded elements (consent/cookie)
        const isExcluded = (window as any).__browse4extract_isExcludedElement(target);
        if (isExcluded) {
          // Hide highlight if hovering excluded element
          highlightBox.style.display = 'none';
          tooltip.style.display = 'none';
          return;
        }

        // Show highlight
        highlightBox.style.display = 'block';
        tooltip.style.display = 'block';

        const rect = target.getBoundingClientRect();

        // Update highlight box (position: fixed uses viewport coordinates)
        highlightBox.style.left = rect.left + 'px';
        highlightBox.style.top = rect.top + 'px';
        highlightBox.style.width = rect.width + 'px';
        highlightBox.style.height = rect.height + 'px';

        // Update tooltip
        const tagName = target.tagName.toLowerCase();
        const className = target.className ? `.${(target as HTMLElement).className.split(' ').join('.')}` : '';
        const id = target.id ? `#${target.id}` : '';
        const selectorText = `${tagName}${id}${className}`;

        tooltip.textContent = selectorText;
        tooltip.style.left = e.clientX + 10 + 'px';
        tooltip.style.top = e.clientY + 10 + 'px';
      };

      // Click handler - select element
      const handleClick = (e: MouseEvent) => {
        // CRITICAL: Prevent navigation and all default actions
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Use elementFromPoint to get the actual element under cursor (not just event target)
        // This ensures we get the <a> element even if clicking on text inside it
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (!target || target.closest('#browse4extract-picker-overlay, #browse4extract-banner')) {
          return;
        }

        // Check if element is excluded (consent/cookie)
        const isExcluded = (window as any).__browse4extract_isExcludedElement(target);
        if (isExcluded) {
          // Show warning message
          banner.textContent = '❌ Cannot select consent/cookie elements - Choose another element';
          banner.style.background = '#dc2626';
          setTimeout(() => {
            banner.textContent = 'Click on any element to select it (ESC to cancel)';
            banner.style.background = 'linear-gradient(135deg, #6fbb69 0%, #bf8fd7 100%)';
          }, 2000);
          return;
        }

        // Generate optimal selector
        const generateSelector = (el: Element): string => {
          // Helper: Escape special characters in CSS class names
          const escapeCssClassName = (className: string): string => {
            // Escape special CSS characters
            return className.replace(/([:\/\[\]\.#@!$%^&*()+=,~`?<>|{}"'\\])/g, '\\$1');
          };

          // Helper: Filter out utility classes (Tailwind, Bootstrap, etc.)
          const isUtilityClass = (className: string): boolean => {
            const utilityPatterns = [
              /^(p|m|pt|pb|pl|pr|px|py|mt|mb|ml|mr|mx|my)-/,  // padding/margin with values
              /^(w|h|max-w|max-h|min-w|min-h)-/,              // width/height
              /^(text|bg|border|rounded|shadow)[-:]/,         // basic styling
              /^(hover|focus|active|disabled|group-hover|peer-):/,  // state variants
              /^(sm|md|lg|xl|2xl):/,                          // responsive variants
              /^(flex|grid|inline|block|hidden)$/,            // layout without values
              /^(gap|space)-/,                                // spacing
              /^(cursor|pointer|select|appearance|outline)-/, // interactions
              /^transition/,                                  // transitions
              /^(justify|items|content|self|place)-/          // alignment
            ];
            return utilityPatterns.some(pattern => pattern.test(className));
          };

          // Helper: Get meaningful part of an element (tag + important classes or ID)
          const getElementPart = (element: Element): string => {
            // If element has an ID, use it (most specific)
            if (element.id && !element.id.startsWith('browse4extract')) {
              return `#${CSS.escape(element.id)}`;
            }

            const tag = element.tagName.toLowerCase();

            // Get meaningful classes (non-utility, non-browse4extract)
            const allClasses = Array.from(element.classList)
              .filter(c => !c.startsWith('browse4extract') && !isUtilityClass(c));

            // Take first 2-3 meaningful classes
            const meaningfulClasses = allClasses.slice(0, 3);

            if (meaningfulClasses.length > 0) {
              const escapedClasses = meaningfulClasses.map(c => escapeCssClassName(c)).join('.');
              return `${tag}.${escapedClasses}`;
            }

            // Just return tag if no meaningful classes
            return tag;
          };

          // Build path by walking up the DOM tree
          const buildPath = (element: Element, maxDepth: number = 10): string[] => {
            const path: string[] = [];
            let current: Element | null = element;
            let depth = 0;

            while (current && current !== document.body && depth < maxDepth) {
              const part = getElementPart(current);
              path.unshift(part);

              // Stop if we found an ID (it's specific enough)
              if (part.startsWith('#')) {
                break;
              }

              current = current.parentElement;
              depth++;
            }

            return path;
          };

          // Build the complete selector path
          const path = buildPath(el);
          const selector = path.join(' > ');

          // Validate the selector
          try {
            const matches = document.querySelectorAll(selector);

            // If selector is valid and finds reasonable number of elements, use it
            if (matches.length > 0 && matches.length <= 200) {
              return selector;
            }

            // If too many matches, try to make it more specific by keeping only last 5 parts
            if (matches.length > 200 && path.length > 5) {
              const shorterPath = path.slice(-5);
              const shorterSelector = shorterPath.join(' > ');
              const shorterMatches = document.querySelectorAll(shorterSelector);

              if (shorterMatches.length > 0 && shorterMatches.length <= 200) {
                return shorterSelector;
              }
            }

            // Return the full selector even if many matches (better than nothing)
            return selector;

          } catch (e) {
            console.warn('Invalid selector generated:', selector, e);
            // Last resort: just use tag name
            return el.tagName.toLowerCase();
          }
        };

        // Generate XPath
        const generateXPath = (el: Element): string => {
          if (el.id) {
            return `//*[@id="${el.id}"]`;
          }
          if (el === document.body) {
            return '/html/body';
          }
          const siblings = el.parentNode ? Array.from(el.parentNode.children) : [];
          const index = siblings.indexOf(el) + 1;
          const tagName = el.tagName.toLowerCase();
          const parentPath = el.parentElement ? generateXPath(el.parentElement) : '';
          return `${parentPath}/${tagName}[${index}]`;
        };

        // Detect suggested extractor type based on element
        const detectExtractorType = (el: Element): { type: string; attribute?: string } => {
          const tag = el.tagName.toLowerCase();

          // If it's an image, suggest attribute src
          if (tag === 'img') {
            return { type: 'attribute', attribute: 'src' };
          }

          // If element contains an image, suggest attribute src
          const img = el.querySelector('img');
          if (img) {
            return { type: 'attribute', attribute: 'src' };
          }

          // If it's a link directly, suggest text (to extract link text)
          if (tag === 'a') {
            return { type: 'text' };
          }

          // If element contains a link child, suggest child-link-text or child-link-url
          const childLink = el.querySelector('a');
          if (childLink) {
            // Suggest child-link-text if the link has text content
            if (childLink.textContent && childLink.textContent.trim()) {
              return { type: 'child-link-text' };
            }
            // Otherwise suggest extracting the URL
            return { type: 'child-link-url' };
          }

          // Default: extract text
          return { type: 'text' };
        };

        const extractorSuggestion = detectExtractorType(target);

        // Store element info
        (window as any).__browse4extract_selectedElement = {
          selector: generateSelector(target),
          xpath: generateXPath(target),
          tagName: target.tagName.toLowerCase(),
          className: target.className || '',
          id: target.id || '',
          text: target.textContent?.trim().substring(0, 100) || '',
          suggestedExtractorType: extractorSuggestion.type,
          suggestedAttribute: extractorSuggestion.attribute
        };

        // Show confirmation rectangle around selected element
        const rect = target.getBoundingClientRect();

        // Change highlight to green confirmation box (position: fixed)
        highlightBox.style.border = '4px solid #6fbb69';
        highlightBox.style.background = 'rgba(111, 187, 105, 0.25)';
        highlightBox.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.6)';
        highlightBox.style.left = rect.left + 'px';
        highlightBox.style.top = rect.top + 'px';
        highlightBox.style.width = rect.width + 'px';
        highlightBox.style.height = rect.height + 'px';

        // Update banner to show success
        banner.textContent = '✓ Element selected! Closing in 2 seconds...';
        banner.style.background = '#6fbb69';

        // Hide tooltip
        tooltip.style.display = 'none';

        // Remove event listeners immediately to prevent further clicks
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('click', handleClick, true);
        document.removeEventListener('keydown', handleKeyDown);

        // Cleanup after showing confirmation
        setTimeout(() => {
          cleanup();
        }, 2000);
      };

      // ESC key handler - cancel
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
        }
      };

      // Global navigation blocker for form submissions only
      // (Click navigation is already handled by handleClick and network-level interception)
      const preventFormSubmit = (e: Event) => {
        const target = e.target as HTMLElement;
        // Don't block if it's our overlay elements
        if (target.closest('#browse4extract-picker-overlay, #browse4extract-banner')) {
          return;
        }

        // Block form submissions
        if (target.tagName === 'FORM' || target.closest('form')) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      const cleanup = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('click', handleClick, true);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('submit', preventFormSubmit, true);
        overlay.remove();
        banner.remove();
        delete (window as any).__browse4extract_isExcludedElement;
      };

      // Add event listeners
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown);

      // Block form submissions only (clicks are handled by handleClick + network interception)
      document.addEventListener('submit', preventFormSubmit, true);
    });

    // Wait for user to select an element or cancel
    const result = await this.page.evaluate(() => {
      return new Promise<{
        selector: string;
        xpath: string;
        tagName: string;
        className: string;
        id: string;
        text: string;
        suggestedExtractorType: string;
        suggestedAttribute?: string;
      }>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const selected = (window as any).__browse4extract_selectedElement;
          const overlay = document.getElementById('browse4extract-picker-overlay');

          // If element selected
          if (selected) {
            clearInterval(checkInterval);
            delete (window as any).__browse4extract_selectedElement;
            resolve(selected);
          }

          // If overlay removed (cancelled)
          if (!overlay) {
            clearInterval(checkInterval);
            reject(new Error('Element selection cancelled'));
          }
        }, ELEMENT_CHECK_INTERVAL_MS);
      });
      });

      return result;
    } finally {
      // SECURITY: Always clean up navigation blocker (even on error)
      if ((this.page as any).__navigationBlocker) {
        this.page.off('request', (this.page as any).__navigationBlocker);
        delete (this.page as any).__navigationBlocker;
        await this.page.setRequestInterception(false);
      }
    }
  }

  /**
   * Remove the picker overlay from the page
   */
  async removePicker(): Promise<void> {
    await this.page.evaluate(() => {
      const overlay = document.getElementById('browse4extract-picker-overlay');
      const banner = document.getElementById('browse4extract-banner');
      if (overlay) overlay.remove();
      if (banner) banner.remove();
    });

    // Also clean up navigation blocker if still active
    if ((this.page as any).__navigationBlocker) {
      this.page.off('request', (this.page as any).__navigationBlocker);
      delete (this.page as any).__navigationBlocker;
      await this.page.setRequestInterception(false);
    }
  }
}
