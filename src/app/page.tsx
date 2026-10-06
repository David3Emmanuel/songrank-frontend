'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RankerProvider, useRanker } from '../context/RankerContext'
import RankingArena from '../components/RankingArena'
import PoolPrewarm from '../components/PoolPrewarm'
import ResultsView from '../components/ResultsView'
import LandingBackground from '../components/LandingBackground'
import YouTubeImportModal from '../components/YouTubeImportModal'
import TrackArtwork from '../components/TrackArtwork'
import { draftEstimate } from '../lib/sessionProgress'
import { formatDurationMs } from '../lib/videoMetadata'
import { resultsLabel, scopedQuery } from '../lib/searchQuery'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Music2,
  UserRound,
  X,
} from 'lucide-react'
import type { Track } from '../lib/types'
import type { MusicEntityKind, MusicSearchEntity } from '../lib/innertube'

/**
 * What a result that is not a song is called.
 *
 * A search returns albums and artists beside the songs, and they need naming: an
 * album looks like a song row otherwise, and only songs can be added so far.
 */
const KIND_LABELS: Partial<Record<MusicEntityKind, string>> = {
  album: 'Album',
  single: 'Single',
  artist: 'Artist',
  playlist: 'Playlist',
}

// Demo tracks for testing
const DEMO_TRACKS: Track[] = [
  {
    id: '1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    durationMs: 200040,
    coverImage:
      'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
      youtube: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
    },
  },
  {
    id: '2',
    title: 'Save Your Tears',
    artist: 'The Weeknd',
    album: 'After Hours',
    durationMs: 215626,
    coverImage:
      'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/5QO79kh1waicV47BqGRL3g',
      youtube: 'https://www.youtube.com/watch?v=XXYlFuWEuKI',
    },
  },
  {
    id: '3',
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    durationMs: 203064,
    coverImage:
      'https://i.scdn.co/image/ab67616d00001e02c88bae7846e62a8ba59ee0bd',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/39LLxExYz6ewLAcYrzQQyP',
      youtube: 'https://www.youtube.com/watch?v=TUVcZfQe-Kw',
    },
  },
  {
    id: '4',
    title: 'Good 4 U',
    artist: 'Olivia Rodrigo',
    album: 'SOUR',
    durationMs: 178147,
    coverImage:
      'https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/4ZtFanR9U6ndgddUvNcjcG',
      youtube: 'https://www.youtube.com/watch?v=gNi_6U5Pm_o',
    },
  },
  {
    id: '5',
    title: 'Heat Waves',
    artist: 'Glass Animals',
    album: 'Dreamland',
    durationMs: 238805,
    coverImage:
      'https://i.scdn.co/image/ab67616d00001e029e495fb707973f3390850eea',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/02MWAaffLxlfxAUY7c5dvx',
      youtube: 'https://www.youtube.com/watch?v=mRD0-GxqHVo',
    },
  },
]

function DashboardContent() {
  const { initializeRanker, currentPair, isComplete } = useRanker()
  const [showYouTubeImport, setShowYouTubeImport] = useState(false)
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The list being assembled. Nothing is ranked until Start is pressed. */
  const [draft, setDraft] = useState<Track[]>([])
  const [draftName, setDraftName] = useState('')
  /** Search results, waiting to be picked from. */
  const [candidates, setCandidates] = useState<Track[]>([])
  /** Everything the search returned: the songs, and the entities beside them. */
  const [entities, setEntities] = useState<MusicSearchEntity[]>([])
  /**
   * The entities that have been opened, by kind and id.
   *
   * An album, a single, an artist and a playlist all open into their songs, which
   * is the action such a result needs: without one it is a row you can only look
   * at.
   */
  const [opened, setOpened] = useState<
    Record<string, { loading: boolean; error: string; tracks: Track[] }>
  >({})
  /**
   * The artist the search is scoped to, chosen from the results.
   *
   * A chip in the search bar rather than a screen of its own: it narrows what is
   * being searched, and comes off with one tap when it is not wanted.
   */
  const [artistFilter, setArtistFilter] = useState<{
    id: string
    name: string
  } | null>(null)
  const [foundFor, setFoundFor] = useState<{
    query: string
    duplicates: number
    filtered: number
  } | null>(null)

  const estimate = draftEstimate(draft.length)
  const canStart = draft.length > 1
  const inDraft = (id: string) => draft.some((track) => track.id === id)
  /** The playable side of the results, by id, so an entity row can find its song. */
  const tracksById = useMemo(
    () => new Map(candidates.map((track) => [track.id, track])),
    [candidates],
  )

  /**
   * What the results panel lists.
   *
   * Every entity the search returned, in its order, minus the song rows that have
   * no playable track behind them: those are the rows the import folded into
   * another upload or dropped as not a song, and the "Skipped" line above the
   * list already accounts for them. A row whose Add button does nothing is worse
   * than a row that is not there.
   *
   * Songs that the entity slice left out are appended, so nothing addable is
   * hidden by where a row happened to fall.
   */
  const shownResults = useMemo(() => {
    const rows: MusicSearchEntity[] = []
    const listed = new Set<string>()

    for (const entity of entities) {
      if (entity.kind === 'song' || entity.kind === 'video') {
        if (!tracksById.has(entity.id)) continue
        listed.add(entity.id)
      }
      rows.push(entity)
    }

    for (const track of candidates) {
      if (listed.has(track.id)) continue
      rows.push({
        kind: 'song',
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        year: '',
        detail: '',
        durationMs: track.durationMs,
        coverImage: track.coverImage,
      })
    }

    return rows
  }, [entities, candidates, tracksById])

  /**
   * Opens an entity into its songs, or closes it again.
   *
   * The same page shape comes back for an album, a single, an artist and a
   * playlist, so one call covers all four.
   */
  const toggleEntity = useCallback(
    async (entity: MusicSearchEntity) => {
      const key = `${entity.kind}:${entity.id}`

      if (opened[key]) {
        setOpened((current) => {
          const next = { ...current }
          delete next[key]
          return next
        })
        return
      }

      setOpened((current) => ({
        ...current,
        [key]: { loading: true, error: '', tracks: [] },
      }))

      try {
        const params = new URLSearchParams({
          kind: entity.kind,
          id: entity.id,
          title: entity.title,
        })
        const res = await fetch(`/api/expand?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'That did not open.')

        setOpened((current) => ({
          ...current,
          [key]: {
            loading: false,
            error: '',
            tracks: (data.tracks ?? []) as Track[],
          },
        }))
      } catch (err) {
        setOpened((current) => ({
          ...current,
          [key]: {
            loading: false,
            error:
              err instanceof Error
                ? err.message
                : 'That did not open. Give it another go in a moment.',
            tracks: [],
          },
        }))
      }
    },
    [opened],
  )

  /**
   * Adds songs to the draft, skipping any already in it.
   *
   * Appending rather than replacing means a search can top up a pasted list,
   * and Clear list is there for when that was not what was wanted.
   */
  const addToDraft = (incoming: Track[], name?: string) => {
    setDraft((current) => {
      const seen = new Set(current.map((track) => track.id))
      return [...current, ...incoming.filter((track) => !seen.has(track.id))]
    })
    if (name) setDraftName((current) => current || name)
  }

  const removeFromDraft = (id: string) => {
    setDraft((current) => current.filter((track) => track.id !== id))
  }

  const handleStartRanking = () => {
    initializeRanker(draft, draftName || 'My ranking')
  }

  /** The newest search wins: a slower reply arriving late is dropped. */
  const searchIdRef = useRef(0)
  const lastTermRef = useRef('')

  const runSearch = useCallback(async (term: string, label: string) => {
    const trimmed = term.trim()
    if (trimmed.length < 2 || trimmed === lastTermRef.current) return

    lastTermRef.current = trimmed
    const searchId = ++searchIdRef.current
    setIsSearching(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/search-import?q=${encodeURIComponent(trimmed)}`,
      )
      const data = await res.json()
      if (searchId !== searchIdRef.current) return

      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      if (!Array.isArray(data.tracks) || data.tracks.length === 0) {
        throw new Error(`Nothing musical came back for “${label}”.`)
      }

      // Results wait to be picked from rather than landing in the list: a search
      // for one song should not add twenty five others.
      setCandidates(data.tracks as Track[])
      setEntities(
        Array.isArray(data.entities) && data.entities.length > 0
          ? (data.entities as MusicSearchEntity[])
          : (data.tracks as Track[]).map((track) => ({
              kind: 'song' as const,
              id: track.id,
              title: track.title,
              artist: track.artist,
              album: track.album,
              year: '',
              detail: '',
              durationMs: track.durationMs,
              coverImage: track.coverImage,
            })),
      )
      setFoundFor({
        query: label,
        duplicates: Number(data.duplicates ?? 0),
        filtered: Number(data.filtered ?? 0),
      })
    } catch (err) {
      if (searchId !== searchIdRef.current) return
      // Let the same words be tried again after a failure.
      lastTermRef.current = ''
      setError(
        err instanceof Error
          ? err.message
          : 'That search did not work. Give it another go in a moment.',
      )
    } finally {
      if (searchId === searchIdRef.current) setIsSearching(false)
    }
  }, [])

  // Search as they type: wait for a pause, then ask. Enter skips the wait.
  // Choosing an artist changes the query, so this runs again with the filter on.
  useEffect(() => {
    const scoped = scopedQuery(artistFilter?.name, query)
    if (scoped.length < 2) return

    const label = resultsLabel(artistFilter?.name, query)
    const timer = setTimeout(() => {
      void runSearch(scoped, label)
    }, 400)
    return () => clearTimeout(timer)
  }, [query, artistFilter, runSearch])

  // Show results if complete
  if (isComplete) {
    return <ResultsView />
  }

  // Show ranking arena if session active
  if (currentPair) {
    return <RankingArena />
  }

  return (
    <div className='relative min-h-screen overflow-hidden bg-gradient-to-b from-white to-sky-50 text-slate-900'>
      <LandingBackground />

      {/* Warm the first comparison while the list is still being put together.
          Cued and muted, and unmounted above the moment the arena takes over. */}
      {canStart && <PoolPrewarm tracks={draft} />}

      <div className='relative mx-auto w-full max-w-2xl px-6 py-12'>
        <header className='animate-rise text-center'>
          <div className='mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-sky-500 text-white shadow-lg shadow-emerald-500/25'>
            <Music2 size={28} />
          </div>
          <h1 className='text-4xl font-bold tracking-tight'>SongRank</h1>
          <p className='mt-2 text-slate-600'>
            Two songs at a time. Your real ranking at the end.
          </p>
        </header>

        {/* Builder: search and import are tools that fill one list. */}
        <section className='animate-rise mt-8 rounded-3xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-md md:p-5'>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void runSearch(
                scopedQuery(artistFilter?.name, query),
                resultsLabel(artistFilter?.name, query),
              )
            }}
            className='space-y-2'
          >
            {/* The filter sits inside the field, so the artist is visibly part of
                the search rather than a hidden mode. It comes off with one tap. */}
            <div className='flex w-full flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white/80 px-2 py-1.5 transition focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100'>
              {artistFilter && (
                <span className='inline-flex max-w-[60%] items-center gap-1 rounded-full bg-slate-900 py-1 pr-1 pl-2.5 text-xs font-semibold text-white'>
                  <UserRound size={12} className='shrink-0' />
                  <span className='truncate'>{artistFilter.name}</span>
                  <button
                    type='button'
                    onClick={() => setArtistFilter(null)}
                    aria-label={`Remove ${artistFilter.name} from the search`}
                    className='shrink-0 rounded-full p-0.5 transition-colors hover:bg-white/20'
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  artistFilter ? 'Add a song or album' : 'Add songs: an artist or a title'
                }
                aria-label='Search for songs to add'
                className='min-w-[8rem] flex-1 bg-transparent px-2 py-1.5 text-slate-900 outline-none placeholder:text-slate-400'
              />
            </div>
            {isSearching && (
              <p className='px-1 text-xs text-slate-400'>Finding…</p>
            )}
          </form>

          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <button
              onClick={() => setShowYouTubeImport(true)}
              className='rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white'
            >
              Paste a playlist link
            </button>
            <button
              onClick={() => addToDraft(DEMO_TRACKS, 'Demo Mix')}
              className='rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white'
            >
              Try 5 songs
            </button>
            {draft.length > 0 && (
              <button
                onClick={() => {
                  setDraft([])
                  setDraftName('')
                }}
                className='ml-auto rounded-2xl px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-rose-600'
              >
                Clear list
              </button>
            )}
          </div>

          {error && (
            <p className='mt-3 text-sm text-rose-600'>{error}</p>
          )}

          {/* Search results, to pick from */}
          {foundFor && candidates.length > 0 && (
            <div className='mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-3'>
              <div className='flex items-center justify-between gap-2'>
                <p className='min-w-0 truncate text-sm font-semibold'>
                  {shownResults.length} result{shownResults.length !== 1 ? 's' : ''} for “
                  {foundFor.query}”
                </p>
                <div className='flex shrink-0 items-center gap-1'>
                  <button
                    onClick={() => addToDraft(candidates, foundFor.query)}
                    className='rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600'
                  >
                    Add all
                  </button>
                  <button
                    onClick={() => {
                      setFoundFor(null)
                      setCandidates([])
                      setEntities([])
                    }}
                    aria-label='Hide these results'
                    className='rounded-full p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-600'
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {(foundFor.duplicates > 0 || foundFor.filtered > 0) && (
                <p className='mt-1 text-xs text-slate-500'>
                  Skipped{' '}
                  {[
                    foundFor.duplicates > 0
                      ? `${foundFor.duplicates} duplicate upload${
                          foundFor.duplicates === 1 ? '' : 's'
                        }`
                      : null,
                    foundFor.filtered > 0
                      ? `${foundFor.filtered} that ${
                          foundFor.filtered === 1 ? 'is not a song' : 'are not songs'
                        }`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' and ')}
                  .
                </p>
              )}

              <ul className='mt-2 max-h-[38vh] space-y-1.5 overflow-y-auto pr-1'>
                {shownResults.map((entity) => {
                  // A song is added, an artist scopes the search, and anything
                  // else opens into the songs it holds.
                  const track = tracksById.get(entity.id)
                  const duration = track ? formatDurationMs(track.durationMs) : ''
                  const added = track ? inDraft(track.id) : false
                  const isSong = entity.kind === 'song' || entity.kind === 'video'
                  const label = KIND_LABELS[entity.kind]
                  const key = `${entity.kind}:${entity.id}`
                  const open = opened[key]
                  const subtitle = isSong
                    ? [entity.artist, duration || formatDurationMs(entity.durationMs)]
                        .filter(Boolean)
                        .join(' · ')
                    : [entity.artist, entity.year].filter(Boolean).join(' · ')

                  const face = (
                    <>
                      <div
                        className={`h-10 w-10 shrink-0 overflow-hidden bg-slate-100 text-slate-300 ${
                          entity.kind === 'artist' ? 'rounded-full' : 'rounded'
                        }`}
                      >
                        <TrackArtwork src={entity.coverImage} alt={entity.title} />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm leading-tight font-semibold'>
                          {entity.title}
                        </p>
                        <p className='truncate text-xs leading-tight text-slate-500'>
                          {subtitle}
                        </p>
                      </div>
                    </>
                  )

                  return (
                    <li
                      key={key}
                      className='rounded-xl border border-slate-200/80 bg-white/80'
                    >
                      {isSong ? (
                        <div className='flex items-center gap-3 p-2'>
                          {face}
                          {added ? (
                            <span className='shrink-0 pr-2 text-xs text-slate-400'>
                              Added
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                track && addToDraft([track], foundFor.query)
                              }
                              className='shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800'
                            >
                              Add
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            // An artist scopes the search from the search bar;
                            // everything else opens into the songs it holds.
                            if (entity.kind === 'artist') {
                              setArtistFilter({
                                id: entity.id,
                                name: entity.title,
                              })
                              return
                            }
                            void toggleEntity(entity)
                          }}
                          aria-expanded={
                            entity.kind === 'artist'
                              ? undefined
                              : Boolean(open)
                          }
                          className='flex w-full items-center gap-3 p-2 text-left'
                        >
                          {face}
                          <span className='shrink-0 text-xs text-slate-400'>
                            {label}
                          </span>
                          {entity.kind === 'artist' ? (
                            <UserRound
                              size={14}
                              className='shrink-0 text-slate-400'
                            />
                          ) : open ? (
                            <ChevronDown
                              size={16}
                              className='shrink-0 text-slate-400'
                            />
                          ) : (
                            <ChevronRight
                              size={16}
                              className='shrink-0 text-slate-400'
                            />
                          )}
                        </button>
                      )}

                      {open && (
                        <div className='border-t border-slate-200/70 p-2'>
                          {open.loading && (
                            <p className='flex items-center gap-2 px-1 py-2 text-xs text-slate-500'>
                              <Loader2 size={14} className='animate-spin' />
                              Opening
                            </p>
                          )}

                          {open.error && (
                            <p className='px-1 py-2 text-xs text-rose-700'>
                              {open.error}
                            </p>
                          )}

                          {!open.loading && !open.error && (
                            <>
                              <div className='flex items-center justify-between gap-2 px-1 pb-1'>
                                <p className='text-xs text-slate-500'>
                                  {open.tracks.length} song
                                  {open.tracks.length === 1 ? '' : 's'}
                                </p>
                                <button
                                  onClick={() =>
                                    addToDraft(open.tracks, entity.title)
                                  }
                                  className='rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-600'
                                >
                                  Add all
                                </button>
                              </div>
                              <ul className='space-y-1'>
                                {open.tracks.map((song) => {
                                  const songDuration = formatDurationMs(
                                    song.durationMs,
                                  )
                                  return (
                                    <li
                                      key={song.id}
                                      className='flex items-center gap-2 rounded-lg bg-slate-50/80 p-1.5'
                                    >
                                      <div className='h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-100 text-slate-300'>
                                        <TrackArtwork
                                          src={song.coverImage}
                                          alt={song.title}
                                        />
                                      </div>
                                      <div className='min-w-0 flex-1'>
                                        <p className='truncate text-xs leading-tight font-medium'>
                                          {song.title}
                                        </p>
                                        <p className='truncate text-[11px] leading-tight text-slate-500'>
                                          {[song.artist, songDuration]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        </p>
                                      </div>
                                      {inDraft(song.id) ? (
                                        <span className='shrink-0 pr-1 text-[11px] text-slate-400'>
                                          Added
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            addToDraft([song], entity.title)
                                          }
                                          className='shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800'
                                        >
                                          Add
                                        </button>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* The list itself */}
          {draft.length > 0 && (
            <>
              <div className='mt-5 flex items-baseline justify-between gap-3 border-t border-slate-200 pt-4'>
                <p className='font-semibold'>
                  {draft.length} song{draft.length !== 1 ? 's' : ''}
                </p>
                {canStart && (
                  <p className='text-xs text-slate-500'>
                    about {estimate.picks} picks, usually{' '}
                    {estimate.minutesLow} to {estimate.minutesHigh} minutes
                  </p>
                )}
              </div>

              {estimate.isLong && (
                <p className='mt-2 text-xs text-amber-600'>
                  That is a long list. A shorter one is easier to finish, and easy
                  to add to later.
                </p>
              )}

              <ul className='mt-3 max-h-[45vh] space-y-1.5 overflow-y-auto pr-1'>
                {draft.map((track) => {
                  const duration = formatDurationMs(track.durationMs)
                  return (
                    <li
                      key={track.id}
                      className='flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-2'
                    >
                      <div className='h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100 text-slate-300'>
                        <TrackArtwork src={track.coverImage} alt={track.title} />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm leading-tight font-semibold'>
                          {track.title}
                        </p>
                        <p className='truncate text-xs leading-tight text-slate-500'>
                          {track.artist}
                          {duration ? ` · ${duration}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromDraft(track.id)}
                        aria-label={`Remove ${track.title}`}
                        className='shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600'
                      >
                        <X size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <button
            onClick={handleStartRanking}
            disabled={!canStart}
            className='mt-4 w-full rounded-2xl bg-slate-900 py-4 font-semibold text-white shadow-lg shadow-slate-900/10 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40'
          >
            {canStart ? `Start ranking ${draft.length} songs` : 'Start ranking'}
          </button>
        </section>

        <p className='mt-6 text-center text-xs text-slate-400'>
          Imports run on your own free YouTube API key.
        </p>
      </div>

      {/* YouTube Import Modal */}
      {showYouTubeImport && (
        <YouTubeImportModal
          onImport={(tracks, name) => addToDraft(tracks, name)}
          onClose={() => setShowYouTubeImport(false)}
        />
      )}
    </div>
  )
}

export default function Home() {
  return (
    <RankerProvider>
      <DashboardContent />
    </RankerProvider>
  )
}
