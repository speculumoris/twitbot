#!/usr/bin/env node
// scripts/setup-telegram.js
// Interactive setup script for Telegram configuration

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../telegram-config.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

console.log('\n🤖 TwitBot Telegram Setup Wizard\n');
console.log('This wizard will help you create your telegram-config.json file.\n');

async function setup() {
    // Check if config already exists
    if (fs.existsSync(configPath)) {
        const overwrite = await question('⚠️  telegram-config.json already exists. Overwrite? (yes/no): ');
        if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
            console.log('\n✅ Setup cancelled. Existing config preserved.\n');
            rl.close();
            return;
        }
    }

    console.log('\n📝 Please provide the following information:\n');

    // Get bot token
    console.log('1️⃣  Bot Token');
    console.log('   Get this from @BotFather in Telegram');
    console.log('   It looks like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz\n');
    const botToken = await question('   Enter your bot token: ');

    if (!botToken || botToken.trim() === '') {
        console.log('\n❌ Bot token is required!\n');
        rl.close();
        return;
    }

    // Get channel ID
    console.log('\n2️⃣  Channel/Group ID');
    console.log('   For public: @your_channel_username');
    console.log('   For private: -1001234567890 (numeric ID)\n');
    const channelId = await question('   Enter your channel/group ID: ');

    if (!channelId || channelId.trim() === '') {
        console.log('\n❌ Channel ID is required!\n');
        rl.close();
        return;
    }

    // Confirm
    console.log('\n📋 Configuration Summary:');
    console.log('   Bot Token: ' + botToken.substring(0, 10) + '...' + botToken.substring(botToken.length - 5));
    console.log('   Channel ID: ' + channelId);
    console.log('   Enabled: true\n');

    const confirm = await question('✅ Save this configuration? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        console.log('\n❌ Setup cancelled.\n');
        rl.close();
        return;
    }

    // Create config object
    const config = {
        botToken: botToken.trim(),
        channelId: channelId.trim(),
        enabled: true
    };

    // Write to file
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('\n✅ Configuration saved to telegram-config.json\n');

        // Test the configuration
        console.log('🧪 Would you like to test the configuration now? (yes/no): ');
        const test = await question('   ');

        if (test.toLowerCase() === 'yes' || test.toLowerCase() === 'y') {
            console.log('\n🚀 Running test...\n');
            rl.close();

            // Import and run test
            const { initTelegramBot, testTelegramBot } = await import('../src/telegram.js');
            const initialized = initTelegramBot();

            if (initialized) {
                await testTelegramBot();
                console.log('\n✅ Setup complete! Check your Telegram channel for test messages.\n');
            } else {
                console.log('\n❌ Failed to initialize bot. Please check your configuration.\n');
            }
        } else {
            console.log('\n✅ Setup complete! Run "npm run test-telegram" to test.\n');
            rl.close();
        }
    } catch (error) {
        console.error('\n❌ Error saving configuration:', error.message);
        rl.close();
    }
}

setup();
