import type {
  DuelSession,
  DuelResult,
  DuelComparison,
  SongRanking,
  ComparisonHistory,
} from './types'

// Supabase configuration
// In a real app, these would be environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Mock mode flag - set to true for development without Supabase
const MOCK_MODE = !SUPABASE_URL || !SUPABASE_ANON_KEY

// In-memory mock storage for development
const mockSessions: Map<string, DuelSession> = new Map()
const mockResults: Map<string, DuelResult[]> = new Map()

/**
 * Create a new duel session
 */
export async function createDuelSession(
  songPoolIds: string[],
  playlistMetadata: { name: string; coverImage?: string },
  ownerId?: string,
): Promise<{ sessionId: string; shareUrl: string }> {
  if (MOCK_MODE) {
    const sessionId = `mock-${Date.now()}`
    const session: DuelSession = {
      id: sessionId,
      owner_id: ownerId || `anon-${Date.now()}`,
      song_pool_ids: songPoolIds,
      playlist_metadata: playlistMetadata,
      created_at: Date.now(),
      expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
      status: 'active',
    }
    mockSessions.set(sessionId, session)
    mockResults.set(sessionId, [])

    return {
      sessionId,
      shareUrl: `${window.location.origin}/duel/${sessionId}`,
    }
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/duel_sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      owner_id: ownerId,
      anonymous_owner_id: ownerId ? null : `anon-${Date.now()}`,
      song_pool_ids: songPoolIds,
      playlist_metadata: playlistMetadata,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to create duel session')
  }

  const [session] = await response.json()
  return {
    sessionId: session.id,
    shareUrl: `${window.location.origin}/duel/${session.id}`,
  }
}

/**
 * Get duel session by ID
 */
export async function getDuelSession(
  sessionId: string,
): Promise<DuelSession | null> {
  if (MOCK_MODE) {
    return mockSessions.get(sessionId) || null
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/duel_sessions?id=eq.${sessionId}&select=*`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error('Failed to fetch duel session')
  }

  const sessions = await response.json()
  return sessions[0] || null
}

/**
 * Submit ranking results for a duel
 */
export async function submitDuelResult(
  duelId: string,
  rankings: SongRanking[],
  comparisonHistory: ComparisonHistory[],
  userId?: string,
): Promise<void> {
  if (MOCK_MODE) {
    const results = mockResults.get(duelId) || []
    const result: DuelResult = {
      id: `result-${Date.now()}`,
      duel_id: duelId,
      user_id: userId,
      anonymous_id: userId ? undefined : `anon-${Date.now()}`,
      ranking_blob: rankings,
      comparison_history: comparisonHistory,
      completed_at: Date.now(),
    }
    results.push(result)
    mockResults.set(duelId, results)

    // Mark session as completed if we have 2 results
    if (results.length >= 2) {
      const session = mockSessions.get(duelId)
      if (session) {
        session.status = 'completed'
      }
    }
    return
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/duel_results`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      duel_id: duelId,
      user_id: userId,
      anonymous_id: userId ? null : `anon-${Date.now()}`,
      ranking_blob: rankings,
      comparison_history: comparisonHistory,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to submit duel result')
  }

  // Check if both participants have completed
  const resultsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/duel_results?duel_id=eq.${duelId}&select=count`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  )

  if (resultsResponse.ok) {
    const [{ count }] = await resultsResponse.json()
    if (count >= 2) {
      // Mark session as completed
      await fetch(`${SUPABASE_URL}/rest/v1/duel_sessions?id=eq.${duelId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      })
    }
  }
}

/**
 * Get results for a duel session
 */
export async function getDuelResults(duelId: string): Promise<DuelResult[]> {
  if (MOCK_MODE) {
    return mockResults.get(duelId) || []
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/duel_results?duel_id=eq.${duelId}&select=*`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error('Failed to fetch duel results')
  }

  return response.json()
}

/**
 * Calculate duel comparison (compatibility score, agreed favorites, etc.)
 */
export async function getDuelComparison(
  duelId: string,
): Promise<DuelComparison | null> {
  const session = await getDuelSession(duelId)
  if (!session) return null

  const results = await getDuelResults(duelId)
  if (results.length < 2) return null

  const [resultA, resultB] = results

  // Calculate compatibility score (Spearman rank correlation)
  const compatibility = calculateCompatibility(
    resultA.ranking_blob,
    resultB.ranking_blob,
  )

  // Find agreed favorites (both in top 10)
  const topN = 10
  const topA = new Set(resultA.ranking_blob.slice(0, topN).map((r) => r.Song))
  const topB = new Set(resultB.ranking_blob.slice(0, topN).map((r) => r.Song))
  const agreedFavorites = [...topA].filter((song) => topB.has(song))

  // Find controversial (large rank differences)
  const controversial: DuelComparison['controversial'] = []
  const rankMapA = new Map(resultA.ranking_blob.map((r, idx) => [r.Song, idx]))
  const rankMapB = new Map(resultB.ranking_blob.map((r, idx) => [r.Song, idx]))

  for (const song of rankMapA.keys()) {
    if (rankMapB.has(song)) {
      const rankA = rankMapA.get(song)!
      const rankB = rankMapB.get(song)!
      const diff = Math.abs(rankA - rankB)

      if (diff > 10) {
        // Threshold for "controversial"
        controversial.push({ song, rank_a: rankA + 1, rank_b: rankB + 1 })
      }
    }
  }

  // Sort by largest difference
  controversial.sort(
    (a, b) => Math.abs(b.rank_a - b.rank_b) - Math.abs(a.rank_a - a.rank_b),
  )

  return {
    session,
    user_a_result: resultA,
    user_b_result: resultB,
    compatibility_score: compatibility,
    agreed_favorites: agreedFavorites,
    controversial: controversial.slice(0, 5), // Top 5 most controversial
  }
}

/**
 * Calculate compatibility score using normalized rank distance
 */
function calculateCompatibility(
  rankingsA: SongRanking[],
  rankingsB: SongRanking[],
): number {
  const rankMapA = new Map(rankingsA.map((r, idx) => [r.Song, idx]))
  const rankMapB = new Map(rankingsB.map((r, idx) => [r.Song, idx]))

  let sumDistance = 0
  let countCommon = 0

  for (const [song, rankA] of rankMapA) {
    if (rankMapB.has(song)) {
      const rankB = rankMapB.get(song)!
      sumDistance += Math.abs(rankA - rankB)
      countCommon++
    }
  }

  if (countCommon === 0) return 0

  // Normalize: max possible distance is countCommon * (length - 1)
  const maxDistance =
    countCommon * (Math.max(rankingsA.length, rankingsB.length) - 1)
  if (maxDistance === 0) return 1

  const similarity = 1 - sumDistance / maxDistance
  return Math.max(0, Math.min(1, similarity))
}
