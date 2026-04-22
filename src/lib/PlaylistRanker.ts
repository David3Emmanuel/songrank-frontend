import { Matrix, solve, inverse } from 'ml-matrix'
import type { Feedback, ComparisonHistory, SongRanking } from './types'

/**
 * PlaylistRanker: A class for ranking songs based on pairwise comparisons
 * using Ridge Regression with time decay and active learning strategies.
 *
 * Based on the Python implementation using scikit-learn's Ridge regression.
 */
export class PlaylistRanker {
  private history: ComparisonHistory[] = []
  private songs: string[] = []
  private readonly scoreMap: Record<Feedback, number> = {
    'Strong Win A': 2.0,
    'Weak Win A': 1.0,
    Tie: 0.0,
    'Weak Win B': -1.0,
    'Strong Win B': -2.0,
  }

  /**
   * Initialize a PlaylistRanker with an optional list of songs
   * @param songs Initial list of songs to rank
   */
  constructor(songs?: string[]) {
    if (songs) {
      // Remove duplicates and sort
      this.songs = [...new Set(songs)].sort()
    }
  }

  /**
   * Record a user interaction comparing two songs
   * @param songA First song
   * @param songB Second song
   * @param feedback User's comparison feedback
   * @param timestamp Unix timestamp (defaults to current time)
   */
  addSwipe(
    songA: string,
    songB: string,
    feedback: Feedback,
    timestamp?: number,
  ): void {
    if (!(feedback in this.scoreMap)) {
      throw new Error(
        `Invalid feedback. Must be one of: ${Object.keys(this.scoreMap).join(', ')}`,
      )
    }

    const ts = timestamp ?? Date.now() / 1000 // Convert to seconds

    // Ensure songs are tracked
    if (!this.songs.includes(songA)) {
      this.songs.push(songA)
    }
    if (!this.songs.includes(songB)) {
      this.songs.push(songB)
    }

    this.history.push({
      song_a: songA,
      song_b: songB,
      score_diff: this.scoreMap[feedback],
      timestamp: ts,
    })
  }

  /**
   * Calculates the 'Ability' score for each song using Ridge Regression
   * with time decay weights.
   *
   * @param decayHalfLifeDays Half-life for time decay in days (default: 30)
   * @returns Array of song rankings sorted by score (descending)
   */
  computeRankings(decayHalfLifeDays: number = 30): SongRanking[] {
    // If we have no songs at all, return empty
    if (this.songs.length === 0 && this.history.length === 0) {
      return []
    }

    // If no history but we have songs, return them with 0 score
    if (this.history.length === 0) {
      return this.songs.map((song) => ({ Song: song, Score: 0.0 }))
    }

    // --- 1. Identify all unique songs ---
    const historySongs = new Set<string>()
    for (const h of this.history) {
      historySongs.add(h.song_a)
      historySongs.add(h.song_b)
    }

    const uniqueSongs = [...new Set([...historySongs, ...this.songs])].sort()
    const songToIdx = new Map<string, number>()
    uniqueSongs.forEach((song, idx) => songToIdx.set(song, idx))
    const numSongs = uniqueSongs.length

    // --- 2. Build Design Matrix (X) and Response Vector (y) ---
    const numMatches = this.history.length
    const X: number[][] = Array.from({ length: numMatches }, () =>
      Array(numSongs).fill(0),
    )
    const y: number[] = []

    this.history.forEach((row, rowIdx) => {
      const idxA = songToIdx.get(row.song_a)!
      const idxB = songToIdx.get(row.song_b)!
      X[rowIdx][idxA] = 1
      X[rowIdx][idxB] = -1
      y.push(row.score_diff)
    })

    // --- 3. Handle Time Decay (Dynamic Weights) ---
    const currentTime = Date.now() / 1000 // Current time in seconds
    const halfLifeSec = decayHalfLifeDays * 24 * 3600
    const ages = this.history.map((h) => currentTime - h.timestamp)
    const weights = ages.map((age) => Math.pow(2, -age / halfLifeSec))

    // --- 4. Fit Ridge Regression Model ---
    const alpha = 0.1
    const abilities = this.ridgeRegression(X, y, weights, alpha)

    // --- 5. Create ranking results ---
    const rankings: SongRanking[] = uniqueSongs.map((song, idx) => ({
      Song: song,
      Score: abilities[idx],
    }))

    // Sort by score descending
    rankings.sort((a, b) => b.Score - a.Score)

    return rankings
  }

  /**
   * Ridge Regression implementation with sample weights
   * Solves: (X^T * W * X + alpha * I) * beta = X^T * W * y
   *
   * @param X Design matrix
   * @param y Response vector
   * @param weights Sample weights for time decay
   * @param alpha Regularization parameter
   * @returns Coefficient vector (abilities)
   */
  private ridgeRegression(
    X: number[][],
    y: number[],
    weights: number[],
    alpha: number,
  ): number[] {
    const Xmat = new Matrix(X)
    const yVec = Matrix.columnVector(y)
    const wVec = weights

    // Create weight matrix (diagonal)
    const n = X.length
    const m = X[0].length
    const W = Matrix.zeros(n, n)
    for (let i = 0; i < n; i++) {
      W.set(i, i, wVec[i])
    }

    // Compute X^T * W
    const XtW = Xmat.transpose().mmul(W)

    // Compute X^T * W * X
    const XtWX = XtW.mmul(Xmat)

    // Add regularization: X^T * W * X + alpha * I
    const I = Matrix.eye(m)
    const ridge = XtWX.add(I.mul(alpha))

    // Compute X^T * W * y
    const XtWy = XtW.mmul(yVec)

    // Solve: (X^T * W * X + alpha * I) * beta = X^T * W * y
    try {
      const beta = solve(ridge, XtWy)
      return beta.to1DArray()
    } catch (error) {
      // Fallback: use pseudo-inverse if solve fails
      const ridgeInv = inverse(ridge)
      const beta = ridgeInv.mmul(XtWy)
      return beta.to1DArray()
    }
  }

  /**
   * Suggests the next two songs to compare using Active Learning theory.
   * Strategy: Uncertainty Sampling
   * 1. Prioritize unplayed songs (Exploration)
   * 2. Pair songs with closest current scores (Refinement)
   *
   * @returns Tuple of two songs to compare, or null if not enough songs
   */
  getNextPair(): [string, string] | null {
    if (this.songs.length < 2) {
      return null
    }

    // 1. Exploration: Find songs with zero history
    const songsWithHistory = new Set<string>()
    for (const h of this.history) {
      songsWithHistory.add(h.song_a)
      songsWithHistory.add(h.song_b)
    }

    const unplayed = this.songs.filter((s) => !songsWithHistory.has(s))

    if (unplayed.length > 0) {
      // Pick one unplayed song
      const songA = unplayed[Math.floor(Math.random() * unplayed.length)]
      // Pair it with a random opponent
      const opponents = this.songs.filter((s) => s !== songA)
      const opponent = opponents[Math.floor(Math.random() * opponents.length)]
      return [songA, opponent]
    }

    // 2. Refinement: scored selection over ALL pairs balancing three signals:
    //    ambiguity  = 1 / (gap + GAP_EPS)          small gap → high priority
    //    freshness  = exp(-DECAY × timesCompared)   penalise repeated pairs
    //    interest   = 1 / (avgRankPos + 1)          favour top-ranked songs
    const currentRankings = this.computeRankings()

    if (currentRankings.length === 0) {
      return this.randomPair()
    }

    const rankedSongs = currentRankings.map((r) => r.Song)
    const scores = currentRankings.map((r) => r.Score)

    // Count how many times each unordered pair has been compared
    const pairCounts = new Map<string, number>()
    for (const h of this.history) {
      const key = [h.song_a, h.song_b].sort().join('|')
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
    }

    const DECAY = 0.7   // exp(-0.7) ≈ 0.5: each repeat roughly halves priority
    const GAP_EPS = 0.1 // prevents ÷0; gap=0 → ambiguity score 10

    type Candidate = { i: number; j: number; priority: number }
    const candidates: Candidate[] = []

    for (let i = 0; i < rankedSongs.length - 1; i++) {
      for (let j = i + 1; j < rankedSongs.length; j++) {
        const gap = Math.abs(scores[i] - scores[j])
        const key = [rankedSongs[i], rankedSongs[j]].sort().join('|')
        const timesCompared = pairCounts.get(key) ?? 0
        const avgRank = (i + j) / 2

        const priority =
          (1 / (gap + GAP_EPS)) *
          Math.exp(-DECAY * timesCompared) *
          (1 / (avgRank + 1))

        candidates.push({ i, j, priority })
      }
    }

    // Weighted random selection (softmax-style)
    const total = candidates.reduce((s, c) => s + c.priority, 0)
    if (total === 0) return this.randomPair()

    let rand = Math.random() * total
    for (const c of candidates) {
      rand -= c.priority
      if (rand <= 0) return [rankedSongs[c.i], rankedSongs[c.j]]
    }

    // Fallback for floating-point edge case
    return [rankedSongs[0], rankedSongs[1]]
  }

  /**
   * Calculate confidence metric based on ranking stability
   * Returns 0-1 where 1 is highly confident
   */
  getConfidence(): number {
    if (this.history.length === 0 || this.songs.length < 2) {
      return 0
    }

    const rankings = this.computeRankings()
    if (rankings.length < 2) return 0

    // Calculate average gap between adjacent songs
    const scores = rankings.map((r) => r.Score)
    let totalGap = 0
    for (let i = 0; i < scores.length - 1; i++) {
      totalGap += Math.abs(scores[i] - scores[i + 1])
    }
    const avgGap = totalGap / (scores.length - 1)

    // Normalize: larger gaps = more confidence
    // Heuristic: confidence increases with comparisons and gap size
    const comparisonsPerSong = this.history.length / this.songs.length
    const gapConfidence = Math.min(avgGap / 2, 1) // Cap at 1
    const volumeConfidence = Math.min(comparisonsPerSong / 5, 1) // Cap at 5 comparisons per song

    return (gapConfidence + volumeConfidence) / 2
  }

  /**
   * Helper method to get a random pair of songs
   */
  private randomPair(): [string, string] | null {
    if (this.songs.length < 2) {
      return null
    }

    const shuffled = [...this.songs].sort(() => Math.random() - 0.5)
    return [shuffled[0], shuffled[1]]
  }

  /**
   * Get all songs being tracked
   */
  getSongs(): string[] {
    return [...this.songs]
  }

  /**
   * Get comparison history
   */
  getHistory(): ComparisonHistory[] {
    return [...this.history]
  }

  /**
   * Remove and return the most recent comparison (for undo support)
   */
  undoLastComparison(): ComparisonHistory | null {
    if (this.history.length === 0) return null
    return this.history.pop() ?? null
  }

  /**
   * Load state from serialized data (for session restore)
   */
  loadState(songs: string[], history: ComparisonHistory[]): void {
    this.songs = [...new Set(songs)].sort()
    this.history = [...history]
  }

  /**
   * Export state for persistence
   */
  exportState(): { songs: string[]; history: ComparisonHistory[] } {
    return {
      songs: [...this.songs],
      history: [...this.history],
    }
  }
}
