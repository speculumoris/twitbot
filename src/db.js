import mongoose from 'mongoose';

// Connection URL - Change this if using Atlas or different host
const MONGO_URI = 'mongodb://127.0.0.1:27017/twitbot';

// Connect to MongoDB
try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB');
} catch (err) {
    console.error('[DB] MongoDB connection error:', err);
}

// Schemas
const accountSchema = new mongoose.Schema({
    cookies: { type: Array, required: true }, // Store parsed JSON directly
    last_updated: { type: Date, default: Date.now },
    username: String
});

const tweetSchema = new mongoose.Schema({
    hashtag: String,
    author: String,
    text: String,
    url: { type: String, unique: true },
    created_at: String // or Date if formatted
});

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
        // Upsert based on URL to avoid duplicates
        await Tweet.updateOne(
            { url: tweetData.url },
            { $set: tweetData },
            { upsert: true }
        );
    } catch (e) {
        console.error('[DB] Error saving tweet:', e);
    }
};

// Helper to close connection if needed (e.g. script end)
export const closeDb = async () => {
    await mongoose.connection.close();
};
