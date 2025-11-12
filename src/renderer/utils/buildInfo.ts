/**
 * Build Information Utilities
 * Provides version and build date information for the application
 */

import packageJson from '../../../package.json';

// Variables injected by webpack DefinePlugin at build time
declare const BUILD_DATE: string;
declare const BUILD_TIME: string;
declare const APP_VERSION: string;

/**
 * Get the application version from package.json
 */
export function getAppVersion(): string {
  // APP_VERSION is injected by webpack DefinePlugin at build time
  if (typeof APP_VERSION !== 'undefined') {
    return APP_VERSION;
  }

  // Fallback to package.json import for development
  return packageJson.version;
}

/**
 * Get the build date (injected by webpack at build time)
 */
export function getBuildDate(): string {
  // BUILD_DATE is injected by webpack DefinePlugin
  // Format: YYYY-MM-DD
  if (typeof BUILD_DATE !== 'undefined') {
    return BUILD_DATE;
  }

  // Fallback for development (when not built with webpack)
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the full version string with build date
 * Format: "1.0.0 (Build: 2025-01-12)"
 */
export function getFullVersionString(): string {
  return `${getAppVersion()} (Build: ${getBuildDate()})`;
}

/**
 * Get formatted build date for display
 * Format: "January 12, 2025"
 */
export function getFormattedBuildDate(): string {
  const date = new Date(getBuildDate());
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
