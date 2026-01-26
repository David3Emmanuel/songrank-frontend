export type CollectionType = 'playlist' | 'album'

export interface Track {
  id: string // Unique identifier (Spotify ID, YouTube video ID, or generated)
  title: string
  artist: string
  album: string
  isrc?: string
  durationMs: number
  coverImage?: string // Individual track cover (if available)
  externalUrls: {
    spotify?: string
    youtube?: string
    apple?: string
  }
  previewUrl?: string // Audio preview URL
}

export interface SongCollection {
  id: string
  type: CollectionType
  name: string
  description: string
  coverImage?: string
  tracks: Track[]
  snapshotId?: string // For Syncing (Spotify)
  etag?: string // For Syncing (YouTube)
}

export type Feedback =
  | 'Strong Win A'
  | 'Weak Win A'
  | 'Tie'
  | 'Weak Win B'
  | 'Strong Win B'

export interface ComparisonHistory {
  song_a: string
  song_b: string
  score_diff: number
  timestamp: number
}

export interface SongRanking {
  Song: string
  Score: number
}

export interface RankerState {
  currentPair: [string, string] | null
  rankings: SongRanking[]
  completedComparisons: number
  confidence: number // 0-1 scale
}

// Duel/Social types
export interface DuelSession {
  id: string
  owner_id: string
  song_pool_ids: string[]
  playlist_metadata: {
    name: string
    coverImage?: string
  }
  created_at: number
  expires_at: number
  status: 'active' | 'completed' | 'expired'
}

export interface DuelResult {
  id: string
  duel_id: string
  user_id?: string
  anonymous_id?: string
  ranking_blob: SongRanking[]
  comparison_history: ComparisonHistory[]
  completed_at: number
}

export interface DuelComparison {
  session: DuelSession
  user_a_result: DuelResult
  user_b_result: DuelResult
  compatibility_score: number // 0-1, based on ranking correlation
  agreed_favorites: string[] // Songs both ranked in top N
  controversial: Array<{ song: string; rank_a: number; rank_b: number }>
}

// Share Card types
export interface ShareCardConfig {
  top_n: number
  include_stats: boolean
  theme: 'light' | 'dark'
  format: '9:16' | '1:1' | '16:9'
}
