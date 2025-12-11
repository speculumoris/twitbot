(async function () {
    // ------------------------------------------------------------------
    // SINGLETON CHECK (Simple Version)
    // Prevents multiple crawlers from running effectively
    // ------------------------------------------------------------------
    const MY_INSTANCE_ID = Date.now();
    window.TWITBOT_INSTANCE_ID = MY_INSTANCE_ID;

    console.log(`[TwitBot v2.2] Crawler started. Limit: 20 tweets.`);

    const MAX_TWEETS = 20;
    const MAX_ITERATIONS = 15;
    const MAX_NO_NEW_TWEETS = 2;
    const collectedTweets = new Map();

    const log = (msg) => {
        if (window.TWITBOT_INSTANCE_ID === MY_INSTANCE_ID) {
            chrome.runtime.sendMessage({ type: 'log', message: msg });
        }
    };

    function extractTweets() {
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        let count = 0;

        for (const tweet of articles) {
            // STOP CHECK 1: Instance replaced?
            if (window.TWITBOT_INSTANCE_ID !== MY_INSTANCE_ID) break;

            // STOP CHECK 2: Limit reached?
            if (collectedTweets.size >= MAX_TWEETS) break;

            try {
                // Ad Check
                if (/Promoted|Advertisement/i.test(tweet.innerText)) continue;

                const linkElement = tweet.querySelector('a[href*="/status/"]');
                if (!linkElement) continue;

                const url = `https://x.com${linkElement.getAttribute('href')}`;

                if (!collectedTweets.has(url)) {
                    collectedTweets.set(url, {
                        text: tweet.innerText,
                        url: url,
                        created_at: new Date().toISOString(),
                        hashtag: window.TWITBOT_HASHTAG || '#AI',
                        mediaUrl: tweet.querySelector('img[src*="media"]')?.src || null
                    });
                    count++;
                }
            } catch (e) { }
        }
        return count;
    }

    async function humanLikeScroll() {
        const targetScroll = 600 + Math.random() * 800;
        let currentScroll = 0;

        while (currentScroll < targetScroll) {
            // CRITICAL FIX: STOP Scrolling properly if limit reached!
            if (collectedTweets.size >= MAX_TWEETS) return;
            if (window.TWITBOT_INSTANCE_ID !== MY_INSTANCE_ID) return;

            window.scrollBy(0, 100);
            currentScroll += 100;

            // Fast scroll
            await new Promise(r => setTimeout(r, 100 + Math.random() * 100));
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    // MAIN LOOP
    let iterations = 0;
    while (collectedTweets.size < MAX_TWEETS && iterations < MAX_ITERATIONS) {
        if (window.TWITBOT_INSTANCE_ID !== MY_INSTANCE_ID) return;

        iterations++;
        log(`Scanning... (${collectedTweets.size}/${MAX_TWEETS})`);

        extractTweets();

        // STOP IMMEDIATELY if limit reached
        if (collectedTweets.size >= MAX_TWEETS) break;

        log('Scrolling...');
        await humanLikeScroll();
    }

    // SEND RESULTS
    if (window.TWITBOT_INSTANCE_ID === MY_INSTANCE_ID) {
        // Enforce Hard Limit of 20
        const finalTweets = Array.from(collectedTweets.values()).slice(0, 20);
        log(`✅ Done. Sending ${finalTweets.length} tweets.`);

        chrome.runtime.sendMessage({
            type: 'tweets_collected',
            tweets: finalTweets
        });
    }

})();
