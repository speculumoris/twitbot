// src/telegram.js
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';

// Load configuration
let TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

// If env vars not set, try to load from config file
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    try {
        const config = JSON.parse(fs.readFileSync('./telegram-config.json', 'utf8'));
        TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN || config.botToken;
        TELEGRAM_CHANNEL_ID = TELEGRAM_CHANNEL_ID || config.channelId;
    } catch (e) {
        console.warn('[Telegram] No config found. Telegram integration disabled.');
    }
}

let bot = null;
let isEnabled = false;

/**
 * Initialize the Telegram bot
 */
export function initTelegramBot() {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
        console.log('[Telegram] Bot token or channel ID not configured. Skipping Telegram integration.');
        return false;
    }

    try {
        bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
        isEnabled = true;
        console.log('[Telegram] Bot initialized successfully');
        console.log(`[Telegram] Will send messages to: ${TELEGRAM_CHANNEL_ID}`);
        return true;
    } catch (error) {
        console.error('[Telegram] Failed to initialize bot:', error.message);
        return false;
    }
}

/**
 * Format tweet data into a nice Telegram message
 */
function formatTweetMessage(tweet) {
    const parts = [];

    // Author
    if (tweet.author) {
        parts.push(`👤 <b>${escapeHtml(tweet.author)}</b>`);
    }

    // Hashtag
    if (tweet.hashtag) {
        parts.push(`🏷 ${escapeHtml(tweet.hashtag)}`);
    }

    // Tweet text
    if (tweet.text) {
        parts.push(`\n${escapeHtml(tweet.text)}`);
    }

    // Date
    if (tweet.created_at) {
        const date = new Date(tweet.created_at);
        parts.push(`\n📅 ${date.toLocaleString()}`);
    }

    // URL
    if (tweet.url) {
        parts.push(`\n🔗 <a href="${tweet.url}">View on X/Twitter</a>`);
    }

    return parts.join('\n');
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Send a tweet to the Telegram channel with retry logic
 */
/**
 * Send a tweet to the Telegram channel with retry logic
 */
export async function sendTweetToTelegram(tweet, retryCount = 0) {
    if (!isEnabled || !bot) {
        console.log('[Telegram] Bot not enabled, skipping message send');
        return false;
    }

    const MAX_RETRIES = 3;

    try {
        const message = formatTweetMessage(tweet);
        const options = {
            parse_mode: 'HTML',
            disable_web_page_preview: false
        };

        if (tweet.mediaUrl) {
            // Send as PHOTO
            try {
                await bot.sendPhoto(TELEGRAM_CHANNEL_ID, tweet.mediaUrl, {
                    caption: message,
                    parse_mode: 'HTML'
                });
                console.log(`[Telegram] ✓ Sent PHOTO to channel: ${tweet.url}`);
            } catch (photoError) {
                console.error('[Telegram] Failed to send photo, falling back to text:', photoError.message);
                // Fallback to text if photo URL is invalid/expired
                await bot.sendMessage(TELEGRAM_CHANNEL_ID, message, options);
                console.log(`[Telegram] ✓ Sent TEXT fallback to channel: ${tweet.url}`);
            }
        } else {
            // Send as INFO TEXT
            await bot.sendMessage(TELEGRAM_CHANNEL_ID, message, options);
            console.log(`[Telegram] ✓ Sent TEXT to channel: ${tweet.url}`);
        }

        return true;
    } catch (error) {
        // Handle rate limiting (429 error)
        if (error.response && error.response.statusCode === 429) {
            const retryAfter = error.response.body.parameters?.retry_after || 30;

            if (retryCount < MAX_RETRIES) {
                console.log(`[Telegram] Rate limited. Waiting ${retryAfter}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return sendTweetToTelegram(tweet, retryCount + 1);
            } else {
                console.error(`[Telegram] Rate limit exceeded after ${MAX_RETRIES} retries. Skipping tweet.`);
                return false;
            }
        }

        console.error('[Telegram] Failed to send message:', error.message);
        return false;
    }
}

/**
 * Send multiple tweets to Telegram (with rate limiting)
 */
export async function sendTweetsToTelegram(tweets) {
    if (!isEnabled || !bot) {
        console.log('[Telegram] Bot not enabled, skipping batch send');
        return;
    }

    console.log(`[Telegram] Sending ${tweets.length} tweets to channel...`);

    for (let i = 0; i < tweets.length; i++) {
        await sendTweetToTelegram(tweets[i]);

        // Rate limiting: wait 2 seconds between messages to avoid Telegram API limits
        if (i < tweets.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log('[Telegram] Batch send complete');
}

/**
 * Test the Telegram bot connection
 */
export async function testTelegramBot() {
    if (!isEnabled || !bot) {
        console.log('[Telegram] Bot not enabled');
        return false;
    }

    try {
        const me = await bot.getMe();
        console.log(`[Telegram] Bot connected: @${me.username}`);

        // Send test message
        await bot.sendMessage(
            TELEGRAM_CHANNEL_ID,
            '🤖 TwitBot is now connected and ready to send tweets!',
            { parse_mode: 'HTML' }
        );

        console.log('[Telegram] Test message sent successfully');
        return true;
    } catch (error) {
        console.error('[Telegram] Test failed:', error.message);
        return false;
    }
}

export { isEnabled as isTelegramEnabled };
