'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTTS } from './useTTS'

interface UseVoiceIntroductionOptions {
  introText: string
  sessionKey?: string
  autoPlayDelay?: number
  onPlaybackComplete?: () => void
  onError?: (error: Error) => void
}

interface UseVoiceIntroductionReturn {
  hasPlayedIntro: boolean
  showSpeakerButton: boolean
  isPlaying: boolean
  playIntroduction: () => Promise<void>
  resetIntroduction: () => void
}

export function useVoiceIntroduction({
  introText,
  sessionKey = 'simon-intro-played',
  autoPlayDelay = 1000,
  onPlaybackComplete,
  onError
}: UseVoiceIntroductionOptions): UseVoiceIntroductionReturn {
  const [hasPlayedIntro, setHasPlayedIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.cookie.includes(`${sessionKey}=true`)
    }
    return false
  })
  
  const [showSpeakerButton, setShowSpeakerButton] = useState(false)

  const { isPlaying, playText } = useTTS({
    onPlaybackComplete: () => {
      setHasPlayedIntro(true)
      setShowSpeakerButton(false)
      if (typeof window !== 'undefined') {
        // Set cookie with 1 day TTL
        const maxAge = 24 * 60 * 60 // 1 day in seconds
        document.cookie = `${sessionKey}=true; max-age=${maxAge}; path=/`
      }
      onPlaybackComplete?.()
    },
    onError: (error) => {
      if (error.message.includes('play() failed because the user didn\'t interact') || 
          error.message.includes('NotAllowedError') ||
          error.message.includes('user interaction')) {
        console.error('🚫 Autoplay blocked - showing speaker button')
        setShowSpeakerButton(true)
      } else {
        console.error('TTS Error:', error)
        setShowSpeakerButton(true)
      }
      onError?.(error)
    }
  })

  useEffect(() => {
    if (!hasPlayedIntro && !isPlaying && !showSpeakerButton) {
      const timer = setTimeout(async () => {
        try {
          await playText(introText)
        } catch (error) {
          console.error('❌ Voice introduction failed (likely autoplay blocked):', error)
        }
      }, autoPlayDelay)

      return () => clearTimeout(timer)
    }
  }, [hasPlayedIntro, isPlaying, showSpeakerButton, playText, introText, autoPlayDelay])

  const playIntroduction = useCallback(async () => {
    try {
      await playText(introText)
      if (typeof window !== 'undefined') {
        const maxAge = 24 * 60 * 60 // 1 day in seconds
        document.cookie = `${sessionKey}=true; max-age=${maxAge}; path=/`
      }
    } catch (error) {
      console.error('Failed to play introduction:', error)
    }
  }, [playText, introText, sessionKey])

  const resetIntroduction = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Remove cookie by setting it to expire in the past
      document.cookie = `${sessionKey}=; max-age=0; path=/`
    }
    setHasPlayedIntro(false)
    setShowSpeakerButton(false)
  }, [sessionKey])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { resetVoiceIntroduction?: () => void }).resetVoiceIntroduction = resetIntroduction
    }
  }, [resetIntroduction])

  return {
    hasPlayedIntro,
    showSpeakerButton,
    isPlaying,
    playIntroduction,
    resetIntroduction
  }
}
