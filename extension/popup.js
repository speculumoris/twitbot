function updateUI() {
    chrome.storage.local.get(['status', 'lastSync'], async (result) => {
        const indicator = document.getElementById('indicator');
        const statusText = document.getElementById('statusText');
        const lastSync = document.getElementById('lastSync');
        const forceBtn = document.getElementById('forceSync');

        // Check if actually logged in (check cookies directly for UI)
        const cookiesX = await chrome.cookies.getAll({ domain: "x.com" });
        const cookiesTwitter = await chrome.cookies.getAll({ domain: "twitter.com" });
        const allCookies = [...cookiesX, ...cookiesTwitter];

        const isLoggedIn = allCookies.some(c => c.name === 'auth_token');

        if (!isLoggedIn) {
            statusText.textContent = "Not Logged In";
            statusText.style.color = "red";
            indicator.className = 'status-indicator error';
            forceBtn.textContent = "Login to Twitter";
            forceBtn.onclick = () => chrome.tabs.create({ url: 'https://x.com/i/flow/login' });
            // Disable input
            document.getElementById('hashtagInput').disabled = true;
            // Remove the sync listener to avoid errors
            return;
        }

        // Reset button behavior if logged in
        forceBtn.textContent = "Start Manual Crawl";

        const keywordsInput = document.getElementById('keywordsInput');
        const schedulerToggle = document.getElementById('schedulerToggle');

        // Load saved settings
        chrome.storage.local.get(['keywords', 'schedulerEnabled'], (result) => {
            if (result.keywords) keywordsInput.value = result.keywords;
            if (result.schedulerEnabled) schedulerToggle.checked = result.schedulerEnabled;
        });

        // Save settings on change
        keywordsInput.addEventListener('input', () => {
            chrome.storage.local.set({ keywords: keywordsInput.value });
        });

        schedulerToggle.addEventListener('change', () => {
            const enabled = schedulerToggle.checked;
            chrome.storage.local.set({ schedulerEnabled: enabled });

            // Notify background to update alarm
            chrome.runtime.sendMessage({
                action: 'updateScheduler',
                enabled: enabled
            });
        });

        // Manual Crawl Button
        forceBtn.onclick = () => {
            const rawKeywords = keywordsInput.value || '#AI';
            // Take first keyword for manual test or all? Let's just do first one for manual or send all logic
            // For manual, let's just trigger the queue logic in background

            statusText.textContent = "Queueing manual crawl...";
            chrome.runtime.sendMessage({ action: 'startManualQueue', keywords: rawKeywords });
        };

        statusText.textContent = result.status || 'Waiting...';
        statusText.style.color = "#333";

        if (result.status === 'Connected') {
            indicator.className = 'status-indicator connected';
        } else if (result.status && result.status.includes('Error')) {
            indicator.className = 'status-indicator error';
        } else {
            indicator.className = 'status-indicator';
        }

        if (result.lastSync) {
            lastSync.textContent = 'Last synced: ' + new Date(result.lastSync).toLocaleTimeString();
        }
    });
}

// Initial load
updateUI();

// Poll for changes
setInterval(updateUI, 1000);


