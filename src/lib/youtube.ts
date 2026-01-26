import * as YouTubeModule from 'react-youtube'

const YouTube =
  (YouTubeModule as any).default?.default ||
  (YouTubeModule as any).default ||
  YouTubeModule

export default YouTube
export type { YouTubeProps, YouTubePlayer } from 'react-youtube'
