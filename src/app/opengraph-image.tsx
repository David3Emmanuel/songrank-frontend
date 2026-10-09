import { ImageResponse } from 'next/og'

/**
 * The picture a pasted link shows.
 *
 * Rendered rather than shipped as a file so it stays in step with the app's own
 * type and colour, and so there is no binary in the repository. Text only, because
 * a mock of the ranking itself would be a lie about what the app produced.
 */
export const alt = 'SongRank, two songs at a time'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(160deg, #ffffff 0%, #eff6ff 55%, #dcfce7 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 104,
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: -3,
          }}
        >
          SongRank
        </div>
        <div style={{ fontSize: 42, color: '#475569', marginTop: 24 }}>
          Two songs at a time. Your real ranking at the end.
        </div>
        <div style={{ fontSize: 30, color: '#64748b', marginTop: 44 }}>
          Rank an album, a playlist or an artist, then share it.
        </div>
      </div>
    ),
    size,
  )
}
