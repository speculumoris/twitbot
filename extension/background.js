// Configuration
const SERVER_URL = 'http://localhost:3000';
// We will use 2 endpoints: /log and /save-tweets

let crawlerWindowId = null;
let keywordQueue = [];
let isCrawling = false;

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
        addToQueue(keywords);
    }

    // LOGS (From Content Script)
    if (request.type === 'log') {
        console.log('[Crawler Content]', request.message);
    }

    // RESULTS (From Content Script)
    if (request.type === 'tweets_collected') {
        console.log('Received tweets from content script. Saving...');
        saveTweetsToServer(request.tweets);

        // Close the ghost window
        if (crawlerWindowId) {
            chrome.windows.remove(crawlerWindowId);
            crawlerWindowId = null;
        }

        // Finished this keyword
        isCrawling = false;

        // Process next item in queue
        processQueue();
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
    // Add only if not already in queue to avoid duplicates piling up? 
    // Or just push them. Let's push them.
    keywordQueue.push(...keywords);
    processQueue();
}

function processQueue() {
    if (isCrawling) return; // Already busy
    if (keywordQueue.length === 0) {
        console.log('Queue empty. All done.');
        chrome.storage.local.set({ status: 'Idle', lastSync: new Date().toISOString() });
        return;
    }

    const nextKeyword = keywordQueue.shift();
    console.log('Starting crawl for:', nextKeyword);
    startCrawling(nextKeyword);
}

async function startCrawling(hashtag) {
    if (!hashtag) {
        processQueue();
        return;
    }

    isCrawling = true;
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(hashtag)}&src=typed_query&f=live`;

    chrome.storage.local.set({ status: `Crawling ${hashtag}...` });

    // Create a MINIMIZED window (Stealth Mode)
    // 'minimized' state makes it appear in dock/taskbar but not on screen
    const win = await chrome.windows.create({
        url: searchUrl,
        state: 'minimized',
        focused: false
    });

    crawlerWindowId = win.id;

    // We need to wait for the page to load before injecting
    // We'll use a listener on tab updates
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
        if (tab.windowId === win.id && changeInfo.status === 'complete') {

            // Remove listener so we don't inject twice
            chrome.tabs.onUpdated.removeListener(listener);

            console.log('Target page loaded. Injecting crawler...');

            // Execute script
            // We first inject the hashtag variable
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (h) => { window.TWITBOT_HASHTAG = h; },
                args: [hashtag]
            }).then(() => {
                // Then run the file
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['crawler_content.js']
                });
            });
        }
    });
}

async function saveTweetsToServer(tweets) {
    try {
        const response = await fetch(`${SERVER_URL}/save-tweets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tweets })
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
