# SongRank

**Ranking playlists is usually a chore. This makes it a game.**

Ever tried to manually sort a 50-song playlist from Best to Worst? It’s impossible. You lose focus after the top 10. SongRank solves this by breaking it down into simple 1-vs-1 battles. You just decide which of the two songs you prefer right now, and the math engine figures out the rest.

## How it Works

Under the hood, SongRank uses Ridge Regression and Active Learning.

1.  **Matchup:** The app picks two songs it knows the least about.
2.  **Swipe:** You drag the winner. The UI uses physics-based gestures—drag Song A, and it actually gets louder while Song B fades out.
3.  **Math:** Every swipe updates the model running in your browser. It doesn't need you to compare every single pair to build a complete leaderboard. It usually solves a playlist with 85% confidence in just a few minutes.

## Features

### The Game Loop

- Drag to listen. The audio crossfades dynamically based on your finger position.
- Can't decide? Drag down to declare a tie. The model handles it gracefully.
- Watch your Top 10 shift in real-time as you play.

### Socials & Rank Duels

- **Taste Receipts:** Finished a session? Generate a clean, 9:16 card of your Top 5 (complete with album art) to share on Instagram/Twitter.
- **Compatibility Mode:** Send a Duel Link to a friend. They rank the same set of songs, and the app calculates a **Compatibility Score** (0-100%). Finally, scientific proof that your friends have bad taste.

## Tech Stack

- **Framework:** Next.js
- **Math:** `ml-matrix`
- **Data:** Spotify & YouTube APIs
- **State:** React Context + SessionStorage

## Getting Started

### 1. Installation

```bash
pnpm install
```

### 2. (Optional) Set up API Keys

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

#### YouTube Data API v3 (for importing playlists)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Enable "YouTube Data API v3"
4. Create an API Key
5. Add to `.env.local`:
   ```
   NEXT_PUBLIC_YOUTUBE_API_KEY=your_key_here
   ```

**Note:** The YouTube API is free with 10,000 quota units/day (enough for ~100 playlist imports). If you don't set a key, the app will prompt you to enter one in the UI.

#### Supabase (for Rank Duels)

The app works perfectly without Supabase—it runs in mock mode. If you want persistent duel sessions:

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase-schema.sql`
3. Add credentials to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Try it Out

- **Demo Mode:** Click "Try Demo (5 Songs)" to test the swipe mechanics immediately
- **YouTube Import:** Click "Import from YouTube Music", paste a playlist URL, and start ranking your real playlists

## How to Use

### Importing a Playlist

1. Click "Import from YouTube Music"
2. Enter your API key (or it will use the one from `.env.local`)
3. Paste a YouTube playlist URL like:
   ```
   https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf
   ```
4. Click "Import Playlist"

### The Ranking Game

1. Two songs appear side-by-side
2. **Drag the winner** towards the top (or tap the "Prefer" button)
3. **Drag down** if they're equally good (tie)
4. Audio previews crossfade as you drag
5. Continue until the app reaches 85% confidence
6. See your final rankings!

### Sharing Results

- **Share Card:** Generate a social media image (9:16, 1:1, or 16:9) with your Top 5
- **Rank Duel:** Create a challenge link for friends to rank the same songs
