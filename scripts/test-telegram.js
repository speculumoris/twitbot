#!/usr/bin/env node
// scripts/test-telegram.js
// Quick script to test Telegram bot configuration

import { initTelegramBot, testTelegramBot, sendTweetToTelegram } from '../src/telegram.js';

console.log('🤖 TwitBot Telegram Test Utility\n');

const initialized = initTelegramBot();

if (!initialized) {
    console.error('❌ Failed to initialize Telegram bot');
    console.error('   Make sure telegram-config.json exists and is configured correctly');
    process.exit(1);
}

console.log('✓ Bot initialized successfully\n');
console.log('Testing connection...\n');

const success = await testTelegramBot();

if (success) {
    console.log('\n✓ Test message sent successfully!');
    console.log('  Check your Telegram channel to see the message.\n');

    // Send a sample tweet
    console.log('Sending a sample tweet...\n');

    const sampleTweet = {
        hashtag: '#AI',
        author: 'Test User',
        text: 'This is a test tweet from TwitBot! 🤖\n\nIf you see this, your Telegram integration is working perfectly! ✨',
        url: 'https://x.com/test/status/123456789',
        created_at: new Date().toISOString()
    };

    await sendTweetToTelegram(sampleTweet);

    console.log('✓ Sample tweet sent!');
    console.log('  Your Telegram integration is fully functional! 🎉\n');
} else {
    console.error('\n❌ Test failed');
    console.error('   Check the error messages above for details\n');
    process.exit(1);
}

process.exit(0);
