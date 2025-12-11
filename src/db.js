import mongoose from 'mongoose';

// Connection URL - Change this if using Atlas or different host
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/twitbot';

// Connect to MongoDB with retry logic
const connectWithRetry = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            await mongoose.connect(MONGO_URI, {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            console.log('[DB] ✓ Connected to MongoDB');
            return;
        } catch (err) {
            console.error(`[DB] Connection attempt ${i + 1}/${retries} failed:`, err.message);
            if (i === retries - 1) {
                console.error('[DB] ✗ Failed to connect after all retries');
                throw err;
            }
            console.log(`[DB] Retrying in 5 seconds...`);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
};

// Initial connection
try {
    await connectWithRetry();
} catch (err) {
    console.error('[DB] MongoDB connection error:', err);
    console.error('[DB] Server will continue but database operations will fail');
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected. Attempting to reconnect...');
    connectWithRetry().catch(err => {
        console.error('[DB] Reconnection failed:', err.message);
    });
});

mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB error:', err.message);
});

// Schemas
const accountSchema = new mongoose.Schema({
    cookies: { type: Array, required: true }, // Store parsed JSON directly
    last_updated: { type: Date, default: Date.now },
    username: String
});

const tweetSchema = new mongoose.Schema({
    hashtag: {
        type: String,
        required: [true, 'Hashtag is required'],
        trim: true,
        maxlength: [280, 'Hashtag too long']
    },
    author: {
        type: String,
        required: [true, 'Author is required'],
        trim: true,
        maxlength: [100, 'Author name too long']
    },
    text: {
        type: String,
        required: [true, 'Tweet text is required'],
        maxlength: [4000, 'Tweet text too long']
    },
    url: {
        type: String,
        required: [true, 'Tweet URL is required'],
        unique: true,
        validate: {
            validator: function (v) {
                return /^https:\/\/(x\.com|twitter\.com)\//.test(v);
            },
            message: 'Invalid Twitter/X URL format'
        }
    },
    created_at: {
        type: String,
        required: [true, 'Created date is required']
    },
    mediaUrl: String, // NEW: Stores image URL if present
    userId: { type: String, index: true }, // Optional userId link

    // TELEGRAM STATUS TRACKING
    telegram_status: {
        type: String,
        enum: ['pending', 'sent', 'failed'],
        default: 'pending',
        index: true
    },
    telegram_sent_at: Date,
    telegram_error: String
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Add indexes for better query performance
tweetSchema.index({ url: 1 }, { unique: true });
tweetSchema.index({ hashtag: 1, created_at: -1 });
tweetSchema.index({ created_at: -1 });
tweetSchema.index({ author: 1 });
tweetSchema.index({ telegram_status: 1 }); // Important for finding pending tweets

// Models
const Account = mongoose.model('Account', accountSchema);
const Tweet = mongoose.model('Tweet', tweetSchema);

export const saveAccount = async (cookies) => {
    // For simplicity, we want one active session mostly. 
    // We can delete old ones or just add new. 
    // Let's keep the latest one active.

    // Optional: Delete older accounts to keep DB clean for this specific single-user bot use case
    // await Account.deleteMany({}); 

    const account = new Account({ cookies });
    const saved = await account.save();
    console.log(`[DB] Saved account with ID: ${saved._id}`);
    return saved._id;
};

export const getLatestAccount = async () => {
    // Get the most recently updated account
    const account = await Account.findOne().sort({ last_updated: -1 });
    if (account) {
        return {
            ...account.toObject(),
            // cookies is already an array/object in Mongoose if defined as Array, 
            // but let's ensure it returns what consumer expects
            cookies: account.cookies
        };
    }
    return null;
};

export const saveTweet = async (tweetData) => {
    try {
        // Validate required fields before saving
        if (!tweetData.url || !tweetData.text || !tweetData.author) {
            console.error('[DB] Invalid tweet data - missing required fields:', {
                hasUrl: !!tweetData.url,
                hasText: !!tweetData.text,
                hasAuthor: !!tweetData.author
            });
            return false;
        }

        // DUPLICATE PREVENTION: URL Normalization
        // Remove query parameters (e.g., ?s=20, ?t=...) to ensure uniqueness
        // https://x.com/u/status/123?s=20 -> https://x.com/u/status/123
        const cleanUrl = tweetData.url.split('?')[0];

        // Upsert based on CLEAN URL to avoid duplicates
        // We set telegram_status to 'pending' ONLY on insert (setOnInsert)
        // If it already exists, we preserve the existing status (e.g., 'sent')
        const result = await Tweet.updateOne(
            { url: cleanUrl },
            {
                $set: {
                    ...tweetData,
                    url: cleanUrl // Ensure we save the clean URL
                },
                $setOnInsert: { telegram_status: 'pending' },
                $addToSet: { found_by: tweetData.userId } // Optional: Track who found it
            },
            { upsert: true, runValidators: true }
        );

        if (result.upsertedCount > 0) {
            console.log(`[DB] ✓ New tweet saved (queued for Telegram): ${cleanUrl}`);
            // Background worker handles sending
        } else if (result.modifiedCount > 0) {
            console.log('[DB] ✓ Tweet updated (already exists):', cleanUrl);
        } else {
            console.log('[DB] Tweet already exists (no changes):', cleanUrl);
        }

        return true;
    } catch (e) {
        // Handle validation errors specifically
        if (e.name === 'ValidationError') {
            console.error('[DB] Validation error:', e.message);
            Object.keys(e.errors).forEach(key => {
                console.error(`  - ${e.errors[key].path}: ${e.errors[key].message}`);
            });
        } else if (e.code === 11000) {
            console.error('[DB] Duplicate tweet URL:', tweetData.url);
        } else {
            console.error('[DB] Error saving tweet:', e.message);
        }
        return false;
    }
};

// NEW: Function to get pending tweets for the worker
export const getPendingTweets = async (limit = 10) => {
    return await Tweet.find({ telegram_status: 'pending' })
        .sort({ created_at: 1 }) // FIFO: send oldest first
        .limit(limit);
};

// NEW: Function to update status after sending
export const updateTweetStatus = async (tweetId, status, error = null) => {
    const update = {
        telegram_status: status,
        telegram_sent_at: status === 'sent' ? new Date() : undefined
    };
    if (error) update.telegram_error = error;

    await Tweet.findByIdAndUpdate(tweetId, { $set: update });
};

// Helper to close connection if needed (e.g. script end)
export const closeDb = async () => {
    await mongoose.connection.close();
};
