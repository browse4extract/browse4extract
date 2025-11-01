# Getting Started with Browse4Extract

## Installation

### Pre-built Binaries

Download the latest release for your platform:
- **Windows**: `Browse4Extract-Setup.exe`
- **macOS**: `Browse4Extract.dmg`
- **Linux**: `Browse4Extract.AppImage`

[Download from Releases](https://github.com/Sielanse/Browse4Extract/releases)

### Build from Source

#### Prerequisites
- Node.js 18+ and npm
- Git

#### Steps

```bash
# Clone the repository
git clone https://github.com/Sielanse/Browse4Extract.git
cd Browse4Extract

# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build

# Package executable
npm run package
```

## Quick Start Guide

### 1. Launch the Application

Start Browse4Extract and you'll see the main interface with:
- URL input field
- Visual element picker
- Extractor configuration panel
- Real-time logs and data preview

### 2. Basic Configuration

**URL**: Enter the complete URL of the page you want to scrape
- Example: `https://example.com/products`
- Must include protocol (http:// or https://)

**Output File**: (Optional) Name for the exported file
- Leave empty for auto-generated name: `domain-timestamp.json`
- Supports .json, .csv, .xlsx extensions

**Debug Mode**: Enable to see the browser in action
- Useful for troubleshooting
- Shows Puppeteer browser window

### 3. Using the Visual Element Picker

The Visual Element Picker is the easiest way to select data:

1. **Click "Pick Element"** button next to any field
2. The target webpage opens with an interactive overlay
3. **Hover** over elements - they highlight in blue
4. **Click** on the desired element
5. The selector is **automatically generated**
6. The best extraction type is **auto-detected**

**Tips:**
- Press **ESC** to cancel selection
- Cookie banners are automatically excluded
- Links won't navigate away during picking
- Green confirmation shows your selection for 2 seconds

### 4. Adding Extractors

For each piece of data you want to extract:

**Field Name**: Property name in exported data
- Example: "title", "price", "product_url"

**CSS Selector**: Target element selector
- Generated automatically with Visual Picker
- Or enter manually: `.product-title`, `#price`, `div.item`

**Extraction Type**:
- **Element text**: Extract text content
- **Element attribute**: Extract specific attribute (href, src, data-*, etc.)
- **Child link URL**: Extract href from first child `<a>` tag
- **Child link text**: Extract text from first child `<a>` tag
- **Image source**: Extract src from `<img>` tag

**Attribute Name**: (If extraction type is "attribute")
- Examples: `href`, `src`, `data-id`, `alt`

### 5. Example Configurations

#### Example 1: E-commerce Product List

```
URL: https://example.com/shop

Extractor 1:
- Field Name: product_title
- Selector: .product-card h2
- Type: Element text

Extractor 2:
- Field Name: price
- Selector: .product-price
- Type: Element text

Extractor 3:
- Field Name: product_url
- Selector: .product-card
- Type: Child link URL

Extractor 4:
- Field Name: product_image
- Selector: .product-card img
- Type: Element attribute
- Attribute: src
```

**Output (JSON):**
```json
[
  {
    "product_title": "Awesome Product",
    "price": "$29.99",
    "product_url": "https://example.com/product/1",
    "product_image": "https://example.com/images/product1.jpg"
  },
  ...
]
```

#### Example 2: News Articles

```
URL: https://news-site.com/latest

Extractor 1:
- Field Name: headline
- Selector: h2.article-title
- Type: Element text

Extractor 2:
- Field Name: author
- Selector: .author-name
- Type: Element text

Extractor 3:
- Field Name: article_link
- Selector: article
- Type: Child link URL

Extractor 4:
- Field Name: publish_date
- Selector: time
- Type: Element attribute
- Attribute: datetime
```

### 6. Running the Scraper

1. Click **"Start Scraping"**
2. Watch **real-time logs** on the left panel
3. See **extracted data** appear in the right panel
4. Wait for completion message
5. File is automatically saved to your **Output folder**

### 7. Export Formats

#### JSON (Default)
```json
[
  {
    "field1": "value1",
    "field2": "value2"
  }
]
```

#### CSV
```csv
field1,field2
"value1","value2"
```

#### Excel (XLSX)
Professional spreadsheet with:
- Auto-sized columns
- Header row formatting
- Ready for analysis

## Advanced Features

### Profile Management

**Save Profile**: Save your extractor configuration
- Creates a `.b4e` file
- Stores all extractors and settings
- Quick reuse for similar pages

**Load Profile**: Load previously saved configuration
- Opens `.b4e` file
- Restores all settings instantly

**File Association**: Double-click `.b4e` files to open in Browse4Extract

### Settings

Access via hamburger menu (☰) in top-right:

**Output Folder**: Where exported files are saved
- Default: `~/Downloads/Browse4Extract/outputs`
- Click folder icon to change location

**Saves Folder**: Where profile `.b4e` files are stored
- Default: `~/Downloads/Browse4Extract/saves`
- Click folder icon to change location

**Discord Rich Presence**: Enable/disable Discord integration
- Shows scraping activity on Discord
- Optional feature, works without Discord
- See [Discord Setup Guide](DISCORD_SETUP.md)

### Smart Features

#### Auto-Scroll
- Automatically scrolls the entire page before extraction
- Loads lazy-loaded content (images, infinite scroll)
- Ensures complete data capture

#### Cookie Consent Handling
- Detects 50+ cookie banner patterns
- Automatically accepts or closes consent dialogs
- Supports OneTrust, Didomi, Quantcast, and more

#### Anti-Detection
- **Stealth Mode**: Bypasses bot detection
- **Ad Blocker**: Blocks ads and trackers
- **Realistic User Agent**: Appears as Chrome browser
- **Dark Mode**: Browser opens in dark mode

## Troubleshooting

### Scraping Fails

**Check the URL**
- Must be complete: `https://example.com`
- Verify the site is accessible

**Use Debug Mode**
- Enable debug to see what's happening
- Check if page loads correctly

**Check Selectors**
- Verify selectors with browser DevTools
- Use Visual Picker for accuracy

### No Data Extracted

**Verify Selectors**
- Right-click element → Inspect in browser
- Copy selector from DevTools
- Use Visual Picker for best results

**Check Element Visibility**
- Some content loads after scroll
- Auto-scroll helps with lazy-loaded content

**Preview Selector**
- Use "Preview" button to test before full extraction
- Shows how many elements match

### Elements Not Found

**Wait for Page Load**
- Some sites load content dynamically
- Auto-scroll helps trigger content loading

**More Specific Selectors**
- Use more specific CSS selectors
- Combine classes: `.product-card.featured`
- Use child selectors: `.product-card > h2`

### Application Won't Start

**Check Node.js Version**
- Requires Node.js 18 or higher
- Run: `node --version`

**Reinstall Dependencies**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Check Build**
```bash
npm run build
```

## Tips & Best Practices

### Finding CSS Selectors

**Chrome DevTools Method**:
1. Open page in Chrome
2. Right-click element → Inspect
3. In Elements panel, right-click HTML element
4. Copy → Copy selector

**Best Practices**:
- Prefer IDs: `#unique-id` (most reliable)
- Use classes: `.class-name` (common)
- Avoid nth-child when possible (fragile)
- Be specific: `.product-list .item-title`

### Extraction Performance

**Debug Mode**:
- Use during development/testing
- Disable for production scraping (faster)

**Selector Specificity**:
- More specific = better performance
- Avoid overly broad selectors: `div`

**Data Validation**:
- Preview before full extraction
- Verify data structure

### Respecting Websites

**Rate Limiting**:
- Don't scrape too frequently
- Space out repeated scrapes

**Terms of Service**:
- Review site's ToS
- Respect robots.txt
- Some sites prohibit scraping

**Attribution**:
- Credit data sources when publishing
- Follow copyright laws

## Next Steps

- [Discord Integration Setup](DISCORD_SETUP.md)
- [Development Guide](DEVELOPMENT.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Build Instructions](BUILD_GUIDE.md)

## Need Help?

- [GitHub Issues](https://github.com/Sielanse/Browse4Extract/issues)
- [Documentation](https://github.com/Sielanse/Browse4Extract#readme)
