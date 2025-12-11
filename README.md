# TwitBot - Twitter Hashtag Crawler

A Twitter/X crawler that automatically collects tweets and can send them to a Telegram channel.

## Features

- 🔍 Crawl tweets by hashtag using Chrome Extension
- 💾 Store tweets in MongoDB database
- 📱 **NEW:** Automatically send tweets to Telegram channel
- 🔒 Secure: Uses your browser session (no API keys needed)
- 🤖 Stealthy: Runs in your authenticated browser

## Quick Start (Extension Method)

1.  **Start the Server** (Keep this terminal open):
    ```bash
    node src/server.js
    ```

2.  **Install the Chrome Extension**:
    - Open Chrome and go to `chrome://extensions`.
    - Enable **Developer mode** (top right toggle).
    - Click **Load unpacked**.
    - Select the `extension` folder inside this project (`/Users/yusufsefabayindir/Desktop/twitbot/extension`).

3.  **Sync & Crawl**:
    - Go to [x.com](https://x.com) and make sure you are logged in.
    - Click the **TwitBot** icon (blue bird) in your extensions bar.
    - Click **"Sync & Start Crawling"**.
    - Watch your terminal! The bot will start immediately using your session.

## 📱 Telegram Integration (Optional)

Want to receive crawled tweets in a Telegram channel? See **[TELEGRAM_SETUP.md](./TELEGRAM_SETUP.md)** for detailed setup instructions.

**Quick Setup:**
1. Create a bot with @BotFather
2. Create a Telegram channel and add your bot as admin
3. Create `telegram-config.json` with your bot token and channel ID
4. Restart the server - tweets will automatically be sent to your channel!

