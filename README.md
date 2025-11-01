# Browse4Extract

<div align="center">

![Browse4Extract Logo](assets/app_image.png)

**A powerful Electron desktop application for extracting web data with visual element selection**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-39.0.0-47848F?logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)](https://reactjs.org/)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Development](#development) • [Contributing](#contributing)

</div>

---

## 📖 Table of Contents

- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 About

Browse4Extract is a modern, user-friendly desktop application built with Electron that simplifies web scraping. Unlike traditional scraping tools that require complex selectors or coding knowledge, Browse4Extract features a **visual element picker** that lets you select elements directly on the webpage with a simple click.

Perfect for:
- 📊 Data analysts extracting structured data
- 🔍 Researchers gathering information from websites
- 💼 Marketers collecting competitor data
- 🎓 Students working on data science projects
- 🤖 Anyone who needs to extract data without coding

---

## ✨ Features

### 🎯 **Visual Element Picker**
- Click directly on webpage elements to select them
- Smart selector generation with fallback strategies
- Real-time preview with highlighted elements
- Automatic detection of best extraction method

### 🚀 **Powerful Extraction**
- **Multiple data types**: Text, attributes, links, images
- **Child element support**: Extract nested data (links inside cards, etc.)
- **Batch processing**: Extract from multiple elements at once
- **Smart scrolling**: Auto-loads lazy-loaded content

### 🛡️ **Anti-Detection & Stealth**
- Puppeteer Stealth mode to bypass bot detection
- Ad blocker integrated (blocks ads & trackers)
- Automatic cookie consent handling
- Realistic browser fingerprinting

### 💾 **Export Formats**
- **JSON**: Structured data for APIs and databases
- **CSV**: Ready for Excel and data analysis
- **Excel (XLSX)**: Professional spreadsheets with formatting

### 🎮 **Discord Rich Presence** (Optional)
- Show your scraping activity on Discord
- Real-time progress updates
- Customizable with your own Discord app
- Can be disabled in settings

### ⚙️ **Profile Management**
- Save and load scraping configurations
- Export/import profiles (.b4e files)
- Quick access to frequently used setups

### 🌙 **Dark Mode**
- Beautiful dark UI for reduced eye strain
- Browser opens in dark mode
- Consistent theming throughout

---

## 📦 Installation

### Pre-built Binaries

Download the latest release for your platform:

- **Windows**: `Browse4Extract-Setup.exe`
- **macOS**: `Browse4Extract.dmg`
- **Linux**: `Browse4Extract.AppImage`

👉 [Download from Releases](https://github.com/Sielanse/Browse4Extract/releases)

### Build from Source

#### Prerequisites

- **Node.js** 18+ and npm
- **Git**

#### Steps

```bash
# Clone the repository
git clone https://github.com/Sielanse/Browse4Extract.git
cd Browse4Extract

# Install dependencies
npm install

# Build the application
npm run build

# Run in development mode
npm run dev

# Or package for production
npm run package
```

---

## 🚀 Usage

### Quick Start

1. **Launch the application**
2. **Enter a URL** of the webpage you want to scrape
3. **Click "Pick Element"** to visually select data
4. **Add extractors** for each field you want to capture
5. **Preview** to test your configuration
6. **Run scraping** and export your data!

### Visual Element Picker

The Visual Element Picker is the heart of Browse4Extract:

1. Click the **"Pick Element"** button next to any field
2. The target webpage opens with an interactive overlay
3. **Hover** over elements to see them highlighted in green
4. **Click** on the desired element to select it
5. The selector is automatically generated and populated
6. The best extraction type is suggested (text, attribute, link, etc.)

**Tips:**
- Press **ESC** to cancel selection
- The picker automatically excludes cookie banners and consent popups
- Generates the most reliable selector possible

### Export Formats

#### JSON
```json
[
  {
    "title": "Product Name",
    "price": "$19.99",
    "url": "https://example.com/product"
  }
]
```

#### CSV
```csv
title,price,url
"Product Name","$19.99","https://example.com/product"
```

#### Excel (XLSX)
Professional spreadsheet with auto-sized columns and header formatting.

### Discord Integration

Show your scraping activity on Discord! See [DISCORD_SETUP.md](DISCORD_SETUP.md) for complete instructions.

---

## ⚙️ Configuration

### Settings

Access settings via the **hamburger menu** (top right):

- **Output Folder**: Where exported files are saved
- **Saves Folder**: Where profile files (.b4e) are stored
- **Discord RPC**: Enable/disable Discord integration

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```env
DISCORD_CLIENT_ID=your_discord_app_id
PROJECT_URL=https://github.com/yourusername/browse4extract
```

---

## 🛠️ Development

### Project Structure

```
Browse4Extract/
├── assets/               # Application icons and images
├── src/
│   ├── main/            # Electron main process
│   │   ├── main.ts      # Entry point
│   │   ├── scraper.ts   # Puppeteer scraping logic
│   │   ├── discordRpc.ts # Discord integration
│   │   ├── elementPicker.ts # Visual picker
│   │   └── configManager.ts # Settings management
│   ├── renderer/        # React UI
│   │   ├── App.tsx      # Main component
│   │   └── tailwind.css # Styling
│   ├── preload/         # Electron preload scripts
│   └── types/           # TypeScript definitions
├── dist/                # Compiled output
└── out/                 # Packaged applications
```

### Scripts

```bash
# Development
npm run dev              # Run with hot-reload

# Building
npm run build            # Build for production

# Packaging
npm run package          # Package for all platforms
npm run package:dev      # Quick package (dev build)
```

### Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Electron 39.0.0 |
| **Language** | TypeScript 5.3.2 |
| **UI** | React 18.2.0 |
| **Styling** | Tailwind CSS 4.x |
| **Scraping** | Puppeteer 24.0.0 |
| **Stealth** | puppeteer-extra-plugin-stealth |
| **Excel Export** | ExcelJS 4.4.0 |
| **Discord RPC** | discord-rpc 4.0.1 |

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Guide

1. **Fork** the repository
2. Create a **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. Open a **Pull Request**

### Reporting Issues

Found a bug? Have a feature request?

👉 [Open an issue](https://github.com/Sielanse/Browse4Extract/issues)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with these amazing open-source projects:

- [Electron](https://www.electronjs.org/) - Cross-platform desktop apps
- [Puppeteer](https://pptr.dev/) - Headless Chrome automation
- [React](https://reactjs.org/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [ExcelJS](https://github.com/exceljs/exceljs) - Excel generation

---

<div align="center">

**Made with ❤️ by [Sielanse @ SieApps](https://github.com/Sielanse)**

⭐ **Star this repo** if you find it useful!

[Report Bug](https://github.com/Sielanse/Browse4Extract/issues) • [Request Feature](https://github.com/Sielanse/Browse4Extract/issues)

</div>
