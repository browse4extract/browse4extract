# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-01-31

### Added
- **Visual Element Picker** - Click directly on webpage elements to select them
- **Multiple Export Formats** - JSON, CSV, and Excel (XLSX) export
- **Anti-Detection Features** - Puppeteer Stealth mode and ad blocker
- **Discord Rich Presence** - Show scraping activity on Discord (optional)
- **Profile Management** - Save and load scraping configurations (.b4e files)
- **Dark Mode** - Beautiful dark UI throughout the application
- **Smart Scrolling** - Auto-loads lazy-loaded content
- **Cookie Consent Handling** - Automatic detection and handling of cookie banners
- **Real-time Preview** - Test selectors before full extraction
- **Batch Processing** - Extract from multiple elements at once
- **Child Element Support** - Extract nested data (links inside cards, etc.)
- **Configurable Settings** - Custom output and saves folders
- **Debug Mode** - Visualize the browser in action

### Features

#### Extraction Types
- Text extraction from DOM elements
- HTML attribute extraction (href, src, data-*, etc.)
- Child link URL extraction
- Child link text extraction

#### Visual Element Picker
- Smart selector generation with fallback strategies
- Real-time highlighting of hovered elements
- Automatic exclusion of cookie/consent popups
- Best extraction type auto-detection
- Green/purple theme matching app design

#### Discord Integration
- 5 dynamic states (Idle, Scraping, Completed, Error)
- Real-time progress updates with percentage
- Dynamic emojis based on progress (🔍📊⚡🚀)
- Time tracking and duration display
- Customizable with user's Discord app
- Can be disabled in settings
- Auto-reconnection (5 attempts)

#### Browser
- Dark mode enabled by default
- Emulates `prefers-color-scheme: dark`
- Realistic user agent
- Anti-bot detection measures

### Technical

#### Stack
- Electron 39.0.0
- TypeScript 5.3.2
- React 18.2.0
- Tailwind CSS 4.x
- Puppeteer 24.0.0
- ExcelJS 4.4.0
- discord-rpc 4.0.1

#### Security
- Context isolation enabled
- nodeIntegration disabled
- Secure preload scripts
- Input validation and sanitization
- No hardcoded secrets (uses environment variables)

### Documentation
- Comprehensive README.md
- Discord setup guide (DISCORD_SETUP.md)
- Discord improvements documentation (DISCORD_IMPROVEMENTS.md)
- Contributing guidelines (CONTRIBUTING.md)
- Code cleanup documentation (CODE_CLEANUP.md)
- UI integration examples (DISCORD_UI_EXAMPLE.md)

### Build & Deployment
- Cross-platform support (Windows, macOS, Linux)
- Electron Builder configuration
- Development and production builds
- Portable executable support
- File associations (.b4e files)

## [0.1.0] - Initial Development

### Added
- Basic scraping functionality
- Puppeteer integration
- Simple UI

---

## Version History

### 1.0.0 - First Stable Release
The first production-ready version of Browse4Extract with all core features implemented, tested, and documented.

### 0.1.0 - Alpha
Initial development version with basic functionality.

---

For more detailed information about each release, visit the [Releases page](https://github.com/Sielanse/Browse4Extract/releases).
