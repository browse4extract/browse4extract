/**
 * Log Sanitizer - Filters sensitive data from logs
 * SECURITY: Prevents credentials, tokens, and cookies from being logged
 */

/**
 * Sanitizes URLs by removing credentials (user:pass@domain)
 * @param url - The URL to sanitize
 * @returns Sanitized URL with credentials replaced by ***
 */
export function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Check if URL contains credentials
    if (urlObj.username || urlObj.password) {
      // Replace credentials with asterisks
      urlObj.username = '***';
      urlObj.password = '***';
      return urlObj.toString();
    }

    return url;
  } catch (error) {
    // If URL parsing fails, try basic regex replacement
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
  }
}

/**
 * Sanitizes cookie values by replacing them with ***
 * @param text - Text that may contain cookie information
 * @returns Text with cookie values redacted
 */
export function sanitizeCookies(text: string): string {
  // Pattern: cookie=value or "cookie":"value"
  let sanitized = text;

  // Replace Set-Cookie headers
  sanitized = sanitized.replace(/(Set-Cookie:\s*)([^;]+)/gi, '$1***');

  // Replace cookie values in JSON format
  sanitized = sanitized.replace(/("cookie"\s*:\s*")([^"]+)"/gi, '$1***"');

  // Replace cookie key-value pairs
  sanitized = sanitized.replace(/(\bcookie\s*=\s*)([^;\s]+)/gi, '$1***');

  return sanitized;
}

/**
 * Sanitizes authentication tokens (Bearer, JWT, etc.)
 * @param text - Text that may contain auth tokens
 * @returns Text with tokens redacted
 */
export function sanitizeTokens(text: string): string {
  let sanitized = text;

  // Bearer tokens
  sanitized = sanitized.replace(/(Bearer\s+)([A-Za-z0-9\-._~+/]+=*)/gi, '$1***');

  // JWT tokens (eyJ... pattern)
  sanitized = sanitized.replace(/\beyJ[A-Za-z0-9\-._~+/]+=*/g, 'eyJ***');

  // Authorization headers
  sanitized = sanitized.replace(/(Authorization:\s*)([^\s]+)/gi, '$1***');

  // API keys patterns
  sanitized = sanitized.replace(/([?&](?:api[-_]?key|token|auth)=)([^&\s]+)/gi, '$1***');

  return sanitized;
}

/**
 * Sanitizes file system paths to only show basename
 * @param text - Text that may contain file paths
 * @param keepPaths - If true, keeps full paths (default: false)
 * @returns Text with paths redacted or shortened
 */
export function sanitizePaths(text: string, keepPaths: boolean = false): string {
  if (keepPaths) {
    return text;
  }

  // Windows paths: C:\Users\... -> [...]
  let sanitized = text.replace(/[A-Z]:\\(?:Users|Utilisateurs)\\[^\\]+\\/gi, '[USER]\\');

  // Unix paths: /home/username/ -> [...]
  sanitized = sanitized.replace(/\/home\/[^\/]+\//g, '[USER]/');

  return sanitized;
}

/**
 * Sanitizes JSON objects (commonly logged by Puppeteer, Axios, Electron)
 * @param text - Text that may contain JSON with sensitive data
 * @returns Text with JSON objects sanitized
 */
export function sanitizeJson(text: string): string {
  // SECURITY: Prevent ReDoS (catastrophic backtracking) on large strings
  const MAX_LENGTH = 50000; // 50KB limit for regex processing
  if (text.length > MAX_LENGTH) {
    // For very large strings, try simpler JSON.parse approach instead of regex
    try {
      const parsed = JSON.parse(text);
      const sanitizedObj = sanitizeJsonObject(parsed);
      return JSON.stringify(sanitizedObj);
    } catch {
      // Not parseable as JSON, return as-is to avoid ReDoS
      return text;
    }
  }

  let sanitized = text;

  // Try to detect and parse JSON blocks (with ReDoS protection via length check above)
  const jsonBlockRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  const jsonBlocks = text.match(jsonBlockRegex);

  if (jsonBlocks) {
    jsonBlocks.forEach((block) => {
      try {
        const parsed = JSON.parse(block);
        const sanitizedObj = sanitizeJsonObject(parsed);
        const sanitizedBlock = JSON.stringify(sanitizedObj);
        sanitized = sanitized.replace(block, sanitizedBlock);
      } catch (error) {
        // Not valid JSON, skip
      }
    });
  }

  return sanitized;
}

/**
 * Recursively sanitizes a JSON object
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
function sanitizeJsonObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeJsonObject(item));
  }

  const sanitized: any = {};
  const sensitiveKeys = [
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'auth',
    'authorization',
    'api_key',
    'apikey',
    'api-key',
    'access_token',
    'refresh_token',
    'session',
    'cookie',
    'cookies',
    'credentials',
    'bearer',
    'jwt',
    'key',
    'private_key',
    'privatekey',
  ];

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();

      // Check if key is sensitive
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = '***';
      } else if (typeof obj[key] === 'string') {
        // Sanitize string values (may contain URLs, tokens, etc.)
        sanitized[key] = sanitizeUrl(obj[key]);
        sanitized[key] = sanitizeTokens(sanitized[key]);
      } else if (typeof obj[key] === 'object') {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeJsonObject(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
  }

  return sanitized;
}

/**
 * Sanitizes Axios request/response logs
 * @param text - Text that may contain Axios logs
 * @returns Sanitized text
 */
export function sanitizeAxiosLog(text: string): string {
  let sanitized = text;

  // Axios logs headers as JSON
  sanitized = sanitized.replace(/(headers:\s*)(\{[^}]+\})/gi, (match, prefix, headers) => {
    try {
      const parsed = JSON.parse(headers);
      const sanitizedHeaders = sanitizeJsonObject(parsed);
      return prefix + JSON.stringify(sanitizedHeaders);
    } catch {
      return match;
    }
  });

  // Axios request config
  sanitized = sanitized.replace(/(config:\s*)(\{[^}]+\})/gi, (match, prefix, config) => {
    try {
      const parsed = JSON.parse(config);
      const sanitizedConfig = sanitizeJsonObject(parsed);
      return prefix + JSON.stringify(sanitizedConfig);
    } catch {
      return match;
    }
  });

  return sanitized;
}

/**
 * Sanitizes Puppeteer CDP (Chrome DevTools Protocol) logs
 * @param text - Text that may contain CDP logs
 * @returns Sanitized text
 */
export function sanitizePuppeteerLog(text: string): string {
  let sanitized = text;

  // Puppeteer Network.requestWillBeSent with cookies/headers
  sanitized = sanitized.replace(/(Network\.requestWillBeSent[^{]*\{[^}]+\})/gi, (match) => {
    return sanitizeJson(match);
  });

  // Puppeteer cookies
  sanitized = sanitized.replace(/(Network\.getCookies[^{]*\{[^}]+\})/gi, (match) => {
    return match.replace(/"value"\s*:\s*"[^"]+"/gi, '"value":"***"');
  });

  return sanitized;
}

/**
 * Main sanitization function - applies all filters
 * @param message - The log message to sanitize
 * @param options - Sanitization options
 * @returns Sanitized message safe for logging
 */
export function sanitizeMessage(
  message: string,
  options: {
    sanitizeUrls?: boolean;
    sanitizeCookies?: boolean;
    sanitizeTokens?: boolean;
    sanitizePaths?: boolean;
    sanitizeJson?: boolean;
  } = {}
): string {
  const {
    sanitizeUrls = true,
    sanitizeCookies: sanitizeCookiesOpt = true,
    sanitizeTokens: sanitizeTokensOpt = true,
    sanitizePaths: sanitizePathsOpt = false,
    sanitizeJson: sanitizeJsonOpt = true,
  } = options;

  let sanitized = message;

  // CRITICAL: Sanitize JSON first (Puppeteer, Axios, Electron logs)
  if (sanitizeJsonOpt) {
    sanitized = sanitizeJson(sanitized);
    sanitized = sanitizeAxiosLog(sanitized);
    sanitized = sanitizePuppeteerLog(sanitized);
  }

  if (sanitizeUrls) {
    // Find all URLs in the message and sanitize them
    const urlRegex = /https?:\/\/[^\s"']+/gi;
    const urls = sanitized.match(urlRegex);
    if (urls) {
      urls.forEach((url) => {
        const sanitizedUrl = sanitizeUrl(url);
        sanitized = sanitized.replace(url, sanitizedUrl);
      });
    }
  }

  if (sanitizeCookiesOpt) {
    sanitized = sanitizeCookies(sanitized);
  }

  if (sanitizeTokensOpt) {
    sanitized = sanitizeTokens(sanitized);
  }

  if (sanitizePathsOpt) {
    sanitized = sanitizePaths(sanitized, false);
  }

  return sanitized;
}

/**
 * Test if a message contains sensitive data
 * @param message - The message to test
 * @returns True if sensitive data detected
 */
export function containsSensitiveData(message: string): boolean {
  // Check for credentials in URLs
  if (/:\/\/[^:]+:[^@]+@/.test(message)) {
    return true;
  }

  // Check for tokens
  if (/Bearer\s+[A-Za-z0-9\-._~+/]+=*/.test(message) || /eyJ[A-Za-z0-9\-._~+/]+=*/.test(message)) {
    return true;
  }

  // Check for cookie values
  if (/Set-Cookie:/i.test(message) || /"cookie"\s*:\s*"[^"]+"/i.test(message)) {
    return true;
  }

  return false;
}
