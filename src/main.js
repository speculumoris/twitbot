// src/main.js
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { chromium } from 'playwright';
import { getLatestAccount, saveTweet } from './db.js';

// Configuration
const HASHTAG = process.argv.find(arg => arg.startsWith('#')) || '#AI';

async function main() {
    // Load cookies from DB
    let cookies = [];
    const account = await getLatestAccount();

    if (account) {
        console.log(`Using account loaded from DB(Last updated: ${account.last_updated})`);
        cookies = account.cookies;
    } else {
        console.error('No account found in DB! Please sync using the Chrome Extension first.');
        process.exit(1);
    }

    const crawler = new PlaywrightCrawler({
        headless: false,
        useSessionPool: true,
        persistCookiesPerSession: true,

        requestHandler: async ({ page, request, log }) => {
            // Add cookies to the browser session logic
            await page.context().addCookies(cookies);
            await page.reload(); // Reload to ensure cookies take effect

            log.info(`Processing ${request.url}...`);

            try {
                // Wait for tweets to load
                await page.waitForSelector('article[data-testid="tweet"]', { timeout: 20000 });
            } catch (error) {
                log.warning('Could not find tweets immediately. You might be hitting a rate limit or login issue.');
                // snapshot for debug
                await page.screenshot({ path: 'debug-error.png' });
            }

            let collectedTweets = [];
            let previousHeight = 0;
            const MAX_TWEETS = 10;

            while (collectedTweets.length < MAX_TWEETS) {
                // Extract tweet data from current view
                const newTweets = await page.$$eval('article[data-testid="tweet"]', (tweets) => {
                    return tweets.map(tweet => {
                        const textElement = tweet.querySelector('div[data-testid="tweetText"]');
                        const timeElement = tweet.querySelector('time');
                        const userElement = tweet.querySelector('div[data-testid="User-Name"]');
                        const linkElement = tweet.querySelector('a[href*="/status/"]');

                        return {
                            text: textElement ? textElement.innerText : null,
                            datetime: timeElement ? timeElement.getAttribute('datetime') : null,
                            author: userElement ? userElement.innerText.split('\n')[0] : null,
                            url: linkElement ? `https://x.com${linkElement.getAttribute('href')}` : null,
                        };
                    });
                });

                // Add unique tweets to our list
                for (const t of newTweets) {
                    if (t.url && !collectedTweets.some(existing => existing.url === t.url)) {
                        collectedTweets.push(t);
                    }
                }

                log.info(`Collected ${collectedTweets.length} / ${MAX_TWEETS} tweets...`);

                if (collectedTweets.length >= MAX_TWEETS) break;

                // Scroll down
                previousHeight = await page.evaluate('document.body.scrollHeight');
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                try {
                    // Wait for more tweets to load
                    await page.waitForFunction(
                        (prev) => document.body.scrollHeight > prev,
                        previousHeight,
                        { timeout: 5000 }
                    );
                    // Small random delay to be human-like
                    await page.waitForTimeout(1000 + Math.random() * 2000);
                } catch (e) {
                    log.warning('Scroll timeout or end of page reached.');
                    break;
                }
            }

            log.info(`Finished! Extracted total ${collectedTweets.length} tweets.`);

            // Save to DB and Dataset
            // Truncate to exactly MAX if we over-fetched
            const finalTweets = collectedTweets.slice(0, MAX_TWEETS);

            for (const t of finalTweets) {
                await saveTweet({
                    hashtag: HASHTAG,
                    author: t.author,
                    text: t.text,
                    url: t.url,
                    created_at: t.datetime
                });
            }
            log.info('Tweets saved to DB.');

            await Dataset.pushData(finalTweets);
        },

        failedRequestHandler: ({ request, log }) => {
            log.error(`Request ${request.url} failed.`);
        },
    });

    console.log(`Starting crawler for ${HASHTAG}...`);
    await crawler.run([
        `https://x.com/search?q=${encodeURIComponent(HASHTAG)}&src=typed_query&f=live`,
    ]);

    // Explicit exit to close DB connection
    process.exit(0);
}

main();
