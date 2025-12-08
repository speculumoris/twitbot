// crawler_content.js
// This script runs INSIDE the Twitter page

(async function () {
    console.log('[TwitBot v1.1] Crawler started. Limit: 15 tweets.');

    const MAX_TWEETS = 15; // Updated to be faster
    const collectedTweets = new Map(); // Use Map for dedup by URL

    // Helper to send logs to background
    const log = (msg) => chrome.runtime.sendMessage({ type: 'log', message: msg });

    // Helper to extract tweets from current DOM
    function extractTweets() {
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        let count = 0;

        for (const tweet of articles) {
            // Strict Limit Check
            if (collectedTweets.size >= MAX_TWEETS) break;

            try {
                const textElement = tweet.querySelector('div[data-testid="tweetText"]');
                const timeElement = tweet.querySelector('time');
                const userElement = tweet.querySelector('div[data-testid="User-Name"]');
                const linkElement = tweet.querySelector('a[href*="/status/"]');

                if (linkElement && timeElement) {
                    const url = `https://x.com${linkElement.getAttribute('href')}`;

                    if (!collectedTweets.has(url)) {
                        collectedTweets.set(url, {
                            text: textElement ? textElement.innerText : '',
                            author: userElement ? userElement.innerText.split('\n')[0] : 'Unknown',
                            url: url,
                            created_at: timeElement.getAttribute('datetime'),
                            hashtag: window.TWITBOT_HASHTAG || '#AI'
                        });
                        count++;
                    }
                }
            } catch (e) {
                // ignore
            }
        }
        return count;
    }

    // Main Loop
    let noNewTweetCount = 0;

    while (collectedTweets.size < MAX_TWEETS) {
        const initialSize = collectedTweets.size;
        extractTweets();

        if (collectedTweets.size >= MAX_TWEETS) break;

        if (collectedTweets.size === initialSize) {
            noNewTweetCount++;
        } else {
            noNewTweetCount = 0;
        }

        // If no new tweets parsing...
        if (noNewTweetCount > 5) {
            log('No new tweets found for a while. Stopping.');
            break;
        }

        // Human-like Scrolling
        // Random Scroll Amount
        const scrollAmount = 500 + Math.random() * 800;
        window.scrollBy(0, scrollAmount);

        // Occasional "micro-read"
        if (Math.random() < 0.3) {
            setTimeout(() => {
                window.scrollBy(0, -100 - Math.random() * 200);
            }, 500);
        }

        // Wait Time (Adjusted to 3-7 seconds for better balance)
        const waitTime = 3000 + Math.random() * 4000;
        log(`Collected ${collectedTweets.size}/${MAX_TWEETS}. Waiting ${Math.round(waitTime / 1000)}s...`);

        await new Promise(r => setTimeout(r, waitTime));
    }

    // Finished
    const finalTweets = Array.from(collectedTweets.values()).slice(0, MAX_TWEETS);
    log(`Scraping finished. Sending ${finalTweets.length} tweets to server...`);

    // Send to Background to forward to Server
    chrome.runtime.sendMessage({
        type: 'tweets_collected',
        tweets: finalTweets
    });

})();
