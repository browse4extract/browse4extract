# Discord Rich Presence Configuration

This guide explains how to configure Discord Rich Presence for Browse4Extract.

## 1. Create a Discord Application

1. Go to the **Discord Developer Portal**: https://discord.com/developers/applications
2. Click **"New Application"**
3. Name your application (for example: "Browse4Extract")
4. Click **"Create"**

## 2. Get the Client ID

1. In your application, go to the **"General Information"** tab
2. Copy the **Application ID** (Client ID)
3. In the file `src/main/discordRpc.ts`, replace line 8:
   ```typescript
   const CLIENT_ID = '1433499788418089024'; // Replace with your Client ID
   ```

## 3. Upload Assets (Images)

For Rich Presence to display images correctly, you must upload the following assets:

### 3.1 Access Rich Presence Art Assets

1. In your Discord application, go to **"Rich Presence"** > **"Art Assets"**
2. Click **"Add Image(s)"**

### 3.2 Required Assets

You must create and upload the following images with these **exact names**:

| Asset Name | Description | When Used |
|----------------|-------------|---------------|
| `logo` | Application logo (small) | Secondary icon in all states |
| `idle` | Idle state image | When the app is waiting for action |
| `scraping` | Extraction in progress image | During data extraction |
| `success` | Success image | When extraction is complete |
| `error` | Error image | When an error occurs |

### 3.3 Image Recommendations

- **Format**: PNG with transparent background (recommended) or JPG
- **Minimum size**: 512x512 pixels
- **Maximum size**: 1024x1024 pixels
- **Ratio**: Square (1:1) recommended

### 3.4 Asset Examples

You can create your own images or use free icons:
- **Idle**: A pause or waiting icon
- **Scraping**: A magnifying glass, download, or search icon
- **Success**: A green check mark or tick
- **Error**: A red X or error sign
- **Logo**: Your application logo

## 4. Rich Presence States

The system automatically adapts the display based on the state:

### 💤 Idle State (Inactive)
```
💤 Waiting for action
Ready to extract data
```

### 🔍 Scraping State (Extraction in Progress)
```
🔍 Extracting from example.com
25/100 items (25%)
```
Emojis change based on progress:
- 🔍 : 0-24%
- 📊 : 25-49%
- ⚡ : 50-74%
- 🚀 : 75-100%

### ✅ Completed State (Finished)
```
✅ Extraction completed in 2m 15s
100 items from example.com
```

### ❌ Error State (Failed)
```
❌ Extraction failed (example.com)
Connection timeout
```

## 5. Discord Buttons

Rich Presence displays contextual buttons:

- **Idle State**: "View Project" (GitHub link)
- **Other States**: "View Project" + "Visit Site" (site being scraped)
- **Error State**: "View Project" + "Report Issue" (report a bug)

### 5.1 Customize Project URL

In `src/main/discordRpc.ts`, line 9, modify the URL:
```typescript
const PROJECT_URL = 'https://github.com/Sielanse/Browse4Extract';
```

## 6. Test Rich Presence

1. Ensure Discord is open and running
2. Compile the project: `npm run build`
3. Launch the application: `npm start`
4. Open your Discord profile - you should see Rich Presence active!

## 7. Troubleshooting

### Rich Presence Not Showing
- Check that Discord is running
- Verify the CLIENT_ID is correct
- In Discord, go to **Settings** > **Activity** > Enable **"Display current activity as a status message"**

### Images Not Displaying
- Verify asset names are **exactly** as indicated above (case-sensitive)
- Wait 5-10 minutes after uploading assets (Discord updates its cache)
- Try restarting the application

### "Failed to initialize" Error
- Discord is probably not running
- The application will automatically attempt to reconnect (5 attempts every 10 seconds)

## 8. Advanced Features

### Automatic Reconnection
If Discord closes then reopens, the application will attempt to automatically reconnect (maximum 5 attempts).

### Elapsed Time
Rich Presence automatically displays the time elapsed since scraping started (real-time timer in Discord).

### Automatic Truncation
All text is automatically truncated to 128 characters to comply with Discord limits.

---

**Note**: Rich Presence is optional. If Discord is not installed or running, the application will function normally without displaying presence.
