// Configuration
console.log('BACKGROUND SCRIPT V2.0 (Strict 20 Limit) LOADED');
const SERVER_URL = 'http://localhost:3000';
// We will use 2 endpoints: /log and /save-tweets

let crawlerWindowId = null;
let crawlerTabId = null; // Track the tab ID specifically
let keywordQueue = [];
let isCrawling = false;
let currentInjectionListener = null;

// 1. Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // SCHEDULER UPDATE
    if (request.action === 'updateScheduler') {
        if (request.enabled) {
            console.log('Scheduler ENABLED. Creating alarm.');
            chrome.alarms.create('fiveMinScheduler', { periodInMinutes: 5 });
        } else {
            console.log('Scheduler DISABLED. Clearing alarm.');
            chrome.alarms.clear('fiveMinScheduler');
        }
    }

    // MANUAL QUEUE START
    if (request.action === 'startManualQueue') {
        const keywords = request.keywords.split(',').map(k => k.trim()).filter(k => k);
        const userId = request.userId;

        // Store userId for this crawl session
        if (userId) chrome.storage.local.set({ currentUserId: userId });

        addToQueue(keywords);
    }

    // LOGS (From Content Script)
    if (request.type === 'log') {
        console.log('[Crawler Content]', request.message);
    }

    // RESULTS (From Content Script)
    if (request.type === 'tweets_collected') {
        console.log('Received tweets from content script. Saving...');
        saveTweetsToServer(request.tweets).then(() => {
            // Finished this keyword
            isCrawling = false;

            // SMART QUEUE: Only close if queue is empty
            if (keywordQueue.length === 0) {
                console.log('Queue empty. Closing crawler window.');
                closeCrawlerWindow();
                chrome.storage.local.set({ status: 'Idle', lastSync: new Date().toISOString() });
            } else {
                console.log('Queue has more items. Continuing in same window...');
                processQueue();
            }
        });
    }
});

// ALARM LISTENER
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'fiveMinScheduler') {
        console.log('Alarm fired! Checking for keywords...');
        chrome.storage.local.get(['keywords', 'schedulerEnabled'], (result) => {
            if (result.schedulerEnabled && result.keywords) {
                const keywords = result.keywords.split(',').map(k => k.trim()).filter(k => k);
                addToQueue(keywords);
            }
        });
    }
});

function addToQueue(keywords) {
    console.log('Adding to queue:', keywords);
    keywordQueue.push(...keywords);
    processQueue();
}

function processQueue() {
    if (isCrawling) return; // Already busy

    if (keywordQueue.length === 0) {
        console.log('Queue empty. All done.');
        return;
    }

    const nextKeyword = keywordQueue.shift();
    console.log('Starting crawl for:', nextKeyword);
    startCrawling(nextKeyword);
}

function closeCrawlerWindow() {
    if (crawlerWindowId) {
        chrome.windows.remove(crawlerWindowId).catch(() => { });
        crawlerWindowId = null;
        crawlerTabId = null;
    }
}

async function startCrawling(hashtag) {
    if (!hashtag) {
        processQueue();
        return;
    }

    isCrawling = true;
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(hashtag)}&src=typed_query&f=live`;

    chrome.storage.local.set({ status: `Crawling ${hashtag}...` });

    // CHECK IF WINDOW EXISTS
    let win = null;
    if (crawlerWindowId) {
        try {
            win = await chrome.windows.get(crawlerWindowId);
        } catch (e) {
            crawlerWindowId = null; // Window was closed manually
        }
    }

    if (crawlerWindowId && win) {
        // REUSE WINDOW
        console.log('Reusing existing crawler window...');
        chrome.tabs.update(crawlerTabId, { url: searchUrl });
        setupInjectionListener(crawlerTabId, hashtag);
    } else {
        // CREATE NEW WINDOW
        console.log('Creating new crawler window...');
        // Create an "Off-Screen" window (Ghost Mode)
        // We position it far outside the monitor so the user can't see/click it
        const newWin = await chrome.windows.create({
            url: searchUrl,
            width: 1280,
            height: 800,
            left: 10000,
            top: 10000,
            focused: false,
            state: 'normal'
        });
        crawlerWindowId = newWin.id;
        // Get the tab ID (usually first tab in new window)
        const tabs = await chrome.tabs.query({ windowId: crawlerWindowId });
        crawlerTabId = tabs[0].id;

        setupInjectionListener(crawlerTabId, hashtag);
    }
}

// Reusable listener setup
function setupInjectionListener(tabId, hashtag) {
    // Remove old listener if exists to prevent duplicates
    if (currentInjectionListener) {
        chrome.tabs.onUpdated.removeListener(currentInjectionListener);
    }

    currentInjectionListener = function (tid, changeInfo, tab) {
        if (tid === tabId && changeInfo.status === 'complete') {

            // Remove listener so we don't inject twice for THIS load
            chrome.tabs.onUpdated.removeListener(currentInjectionListener);
            currentInjectionListener = null;

            console.log('Target page loaded. Injecting crawler...');

            setTimeout(() => { // Small delay to ensure render
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (h) => { window.TWITBOT_HASHTAG = h; },
                    args: [hashtag]
                }).then(() => {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['crawler_content.js']
                    }).catch(err => console.error('Injection failed:', err));
                });
            }, 1000);
        }
    };

    chrome.tabs.onUpdated.addListener(currentInjectionListener);
}

async function saveTweetsToServer(tweets) {
    try {
        if (tweets.length > 25) {
            console.error(`[Security Block] Received ${tweets.length} tweets! This violates the limit. Truncating hard.`);
        }

        // Limit to 20 tweets maximum
        const limitedTweets = tweets.slice(0, 20);
        console.log(`Sending ${limitedTweets.length} tweets to server (limited from ${tweets.length})`);

        // Get userId from storage
        const { currentUserId } = await chrome.storage.local.get(['currentUserId']);
        let url = `${SERVER_URL}/save-tweets`;
        if (currentUserId) {
            url += `?userId=${encodeURIComponent(currentUserId)}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tweets: limitedTweets })
        });

        if (!response.ok) {
            console.error('Server save failed');
        } else {
            console.log('Tweets successfully saved to DB');
        }
    } catch (e) {
        console.error('Network error sending tweets', e);
    }
}
