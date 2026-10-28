'use client'

import { useEffect } from 'react'
import { claimAudioFocus } from '@/lib/audio-focus'

export default function AudioFocus() {
  useEffect(() => {
    const play = (event: Event) => {
      const media = event.target
      if (media instanceof HTMLMediaElement && !media.muted && media.volume > 0) claimAudioFocus(media)
    }
    document.addEventListener('play', play, true)
    return () => document.removeEventListener('play', play, true)
  }, [])
  return null
}