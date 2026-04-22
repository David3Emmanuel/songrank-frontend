'use client'

import { useState } from 'react'
import { Users, Copy, Check, Link as LinkIcon, X } from 'lucide-react'
import { createDuelSession } from '../lib/duelApi'
import type { Track } from '../lib/types'

interface DuelInviteModalProps {
  tracks: Track[]
  playlistName?: string
  onClose: () => void
}

export default function DuelInviteModal({
  tracks,
  playlistName = 'My Playlist',
  onClose,
}: DuelInviteModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateDuel = async () => {
    setIsCreating(true)
    setError(null)
    try {
      const songPoolIds = tracks.map((t) => t.id)
      const { shareUrl } = await createDuelSession(songPoolIds, {
        name: playlistName,
        coverImage: tracks[0]?.coverImage,
      })
      setShareUrl(shareUrl)
    } catch (err) {
      console.error('Failed to create duel:', err)
      setError('Failed to create duel challenge. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShare = async () => {
    if (!shareUrl) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SongRank Duel Challenge',
          text: `Can you match my music taste? Rank these ${tracks.length} songs and let's compare!`,
          url: shareUrl,
        })
      } catch (error) {
        // User cancelled or share failed
        console.log('Share cancelled or failed')
      }
    } else {
      // Fallback to copy
      handleCopy()
    }
  }

  return (
    <div className='fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
      <div className='bg-slate-900/95 backdrop-blur-md rounded-2xl p-6 max-w-md w-full border border-white/20'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center'>
              <Users size={24} className='text-white' />
            </div>
            <h2 className='text-2xl font-bold text-white'>
              Challenge a Friend
            </h2>
          </div>
          <button
            onClick={onClose}
            className='w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors'
            aria-label='Close'
          >
            <X size={20} className='text-white' />
          </button>
        </div>

        {!shareUrl ? (
          <>
            {/* Info */}
            <div className='mb-6 space-y-3'>
              <p className='text-white/80'>
                Invite a friend to rank the same {tracks.length} songs and
                discover how similar your music tastes are!
              </p>
              <div className='bg-purple-600/20 border border-purple-500/30 rounded-lg p-4'>
                <p className='text-sm text-purple-200 font-medium'>
                  📊 You&apos;ll see:
                </p>
                <ul className='text-sm text-purple-200/80 mt-2 space-y-1 ml-4'>
                  <li>• Compatibility score (0-100%)</li>
                  <li>• Songs you both love</li>
                  <li>• Your biggest disagreements</li>
                </ul>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className='bg-red-600/20 border border-red-500/30 rounded-lg p-3 mb-4'>
                <p className='text-sm text-red-200'>{error}</p>
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={handleCreateDuel}
              disabled={isCreating}
              className='w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2'
            >
              {isCreating ? (
                <>
                  <div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                  Creating Challenge...
                </>
              ) : (
                <>
                  <LinkIcon size={20} />
                  Create Challenge Link
                </>
              )}
            </button>
          </>
        ) : (
          <>
            {/* Success */}
            <div className='mb-6 space-y-4'>
              <div className='bg-emerald-600/20 border border-emerald-500/30 rounded-lg p-4'>
                <p className='text-emerald-200 font-semibold mb-2'>
                  ✅ Challenge Created!
                </p>
                <p className='text-sm text-emerald-200/80'>
                  Share this link with your friend. They&apos;ll rank the same
                  songs, and you&apos;ll both see the comparison results.
                </p>
              </div>

              {/* URL Display */}
              <div className='bg-white/5 rounded-lg p-3 flex items-center gap-2'>
                <input
                  type='text'
                  value={shareUrl}
                  readOnly
                  className='flex-1 bg-transparent text-white text-sm outline-none'
                />
                <button
                  onClick={handleCopy}
                  className='shrink-0 w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors'
                  aria-label='Copy link'
                >
                  {copied ? (
                    <Check size={20} className='text-emerald-400' />
                  ) : (
                    <Copy size={20} className='text-white' />
                  )}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='flex gap-3'>
              <button
                onClick={handleShare}
                className='flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors'
              >
                Share Link
              </button>
              <button
                onClick={onClose}
                className='flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-lg transition-colors'
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
