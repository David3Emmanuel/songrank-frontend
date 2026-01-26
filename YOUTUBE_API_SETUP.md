# YouTube API Setup Guide

This guide walks you through getting a free YouTube Data API v3 key to import playlists into SongRank.

## Quick Facts

- **Cost:** 100% Free
- **Quota:** 10,000 units/day (enough for ~100 playlist imports)
- **Time:** ~5 minutes to set up
- **Requirements:** Google account

## Step-by-Step Instructions

### 1. Go to Google Cloud Console

Visit: [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)

### 2. Create a Project (if you don't have one)

1. Click the project dropdown at the top
2. Click "New Project"
3. Name it something like "SongRank"
4. Click "Create"

### 3. Enable YouTube Data API v3

1. Click "Enable APIs and Services" (or the "+ ENABLE APIS AND SERVICES" button)
2. Search for "YouTube Data API v3"
3. Click on it
4. Click "Enable"

### 4. Create API Key

1. Go back to [Credentials page](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "API Key"
3. Your key will be generated automatically
4. **Copy it immediately** (you'll need it for the app)

### 5. (Optional) Restrict the API Key

For security, you can restrict the key:

1. Click the pencil icon next to your new API key
2. Under "API restrictions", select "Restrict key"
3. Check only "YouTube Data API v3"
4. Under "Application restrictions", you can set:
   - **HTTP referrers** if deploying to a domain: `yourdomain.com/*`
   - **IP addresses** if running locally: `127.0.0.1`, `::1`
5. Click "Save"

**Note:** For local development, you might want to leave it unrestricted initially.

### 6. Use the API Key

#### Option A: Environment Variable (Recommended)

Add to `.env.local`:

```env
NEXT_PUBLIC_YOUTUBE_API_KEY=AIzaSyC-your-actual-key-here
```

Restart your dev server:

```bash
pnpm dev
```

#### Option B: Enter in UI

When you click "Import from YouTube Music", the app will ask for your API key if it's not set as an environment variable.

## Quota Information

The YouTube Data API uses a quota system:

- **Daily Limit:** 10,000 units
- **Cost per Operation:**
  - List playlist items: ~3 units per 50 videos
  - Get video details: ~1 unit per video
  - **Typical playlist import:** ~50-100 units

### Example Usage

- Small playlist (20 songs): ~25 units
- Medium playlist (50 songs): ~55 units
- Large playlist (100 songs): ~105 units

**You can import ~100-200 playlists per day** depending on size.

## Troubleshooting

### "API key not valid" error

1. Make sure you enabled "YouTube Data API v3" (not just "YouTube API")
2. If you added restrictions, make sure your domain/IP is allowed
3. Wait a few minutes after creating the key (it can take time to activate)

### "Quota exceeded" error

You've hit the 10,000 units/day limit. It resets at midnight Pacific Time. Upgrade to a paid plan if you need more (unlikely for personal use).

### "Access Not Configured" error

You forgot to enable the YouTube Data API v3 in your project. Go back to step 3.

## Security Best Practices

1. **Never commit API keys** to version control (they're in `.gitignore`)
2. **Use environment variables** for deployment
3. **Restrict your key** if deploying publicly
4. **Regenerate immediately** if you accidentally expose your key

## Need Help?

- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [Google Cloud Console](https://console.cloud.google.com)
- Check the main [README.md](./README.md) for app-specific help
