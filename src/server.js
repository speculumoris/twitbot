import express from 'express';
import fs from 'fs';
import { exec } from 'child_process';
import open from 'open';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveAccount, saveTweet } from './db.js';

const app = express();
const PORT = 3000;
const COOKIE_PATH = './cookies.json';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static('public'));

// 1. Serve the landing page with Extension Instructions
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>TwitBot Extension Setup</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; text-align: center; max-width: 800px; margin: 0 auto; color: #333; }
                .btn { 
                    display: inline-block; padding: 15px 30px; background: #1da1f2; color: white; 
                    text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 18px;
                    margin: 20px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s;
                }
                .btn:hover { background: #0c7abf; transform: translateY(-2px); }
                .step { margin: 30px 0; font-size: 18px; text-align: left; background: #f8f9fa; padding: 20px; border-radius: 10px; }
                h1 { margin-bottom: 30px; }
                code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>TwitBot Setup</h1>
            
            <a class="btn" href="/download-extension">📥 Download Extension (.zip)</a>

            <div class="step">
                <strong>1. Download & Unzip:</strong><br>
                Download the file above and unzip it (double click). You should see a folder named <code>extension</code>.
            </div>

            <div class="step">
                <strong>2. Install in Chrome:</strong><br>
                <ul>
                    <li>Open Chrome and go to <a href="chrome://extensions" target="_blank">chrome://extensions</a>.</li>
                    <li>Enable <strong>"Developer mode"</strong> (switch in top right).</li>
                    <li>Click <strong>"Load unpacked"</strong> (top left).</li>
                    <li>Select the unzipped <code>extension</code> folder.</li>
                </ul>
            </div>
            
            <div class="step">
                <strong>3. Login & Sync:</strong><br>
                Go to <a href="https://x.com" target="_blank">Twitter / X</a>. Log in if you aren't already.<br>
                The extension will automatically detect your login and start the crawler on this server!
            </div>
        </body>
        </html>
    `);
});

// Serve the ZIP file
app.get('/download-extension', (req, res) => {
    const zipPath = path.join(__dirname, '../extension.zip');
    if (fs.existsSync(zipPath)) {
        res.download(zipPath);
    } else {
        res.status(404).send('Extension ZIP not found. Please run "zip -r extension.zip extension" in the terminal.');
    }
});

// 2. Receive tweets from Extension
app.post('/save-tweets', async (req, res) => {
    const { tweets } = req.body;

    if (!tweets || !Array.isArray(tweets)) {
        return res.status(400).send('Invalid data');
    }

    console.log(`Received ${tweets.length} tweets from Extension.`);

    try {
        for (const t of tweets) {
            await saveTweet(t);
        }
        console.log('Tweets saved to MongoDB.');
        res.json({ success: true });
    } catch (e) {
        console.error('DB Error:', e);
        res.status(500).send(e.message);
    }
});

// 2. Receive cookies from the browser (Used for sync status check only now)
app.post('/receive-cookies', (req, res) => {
    // We don't save cookies anymore for security reasons.
    // This endpoint now just acknowledges the extension is connected.
    console.log('Extension connected (Cookie sync check). No sensitive data saved.');
    res.json({ success: true, message: 'Connected.' });
});

app.listen(PORT, () => {
    console.log(`Setup server running at http://localhost:${PORT}`);
    open(`http://localhost:${PORT}`);
});
