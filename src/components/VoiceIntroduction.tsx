'use client'

import { useVoiceIntroduction } from '@/hooks/useVoiceIntroduction'
import { Volume2 } from 'lucide-react'
import { SimonLogo } from '@/svgs'

interface VoiceIntroductionProps {
  introText: string
  sessionKey?: string
  autoPlayDelay?: number
  showHelpMessage?: boolean
  className?: string
  logoClassName?: string
  onPlaybackComplete?: () => void
  onError?: (error: Error) => void
}

export default function VoiceIntroduction({
  introText,
  sessionKey = 'simon-intro-played',
  autoPlayDelay = 1000,
  showHelpMessage = true,
  className = '',
  logoClassName = 'w-16 h-16',
  onPlaybackComplete,
  onError
}: VoiceIntroductionProps) {
  const {
    hasPlayedIntro,
    showSpeakerButton,
    isPlaying,
    playIntroduction
  } = useVoiceIntroduction({
    introText,
    sessionKey,
    autoPlayDelay,
    onPlaybackComplete,
    onError
  })

  return (
    <div className={`text-center ${className}`}>
      <div 
        className={`relative bg-gray-900 rounded-full flex items-center justify-center mx-auto ${
          showSpeakerButton && !hasPlayedIntro && !isPlaying ? 'cursor-pointer hover:bg-gray-800 transition-colors' : ''
        } ${logoClassName}`}
        onClick={showSpeakerButton && !hasPlayedIntro && !isPlaying ? playIntroduction : undefined}
      >
        <SimonLogo 
          className={logoClassName}
          aria-label="Simon"
        />
        
        {isPlaying && (
          <div className="absolute -inset-1 border-2 border-blue-400 rounded-full animate-pulse" />
        )}
        
        {showSpeakerButton && !hasPlayedIntro && !isPlaying && (
          <div className="absolute -inset-1 border-2 border-blue-400 rounded-full animate-pulse opacity-60" />
        )}
      </div>

      {showHelpMessage && showSpeakerButton && !hasPlayedIntro && !isPlaying && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <div className="flex items-center gap-2 justify-center">
            <Volume2 className="w-4 h-4" />
            <span className="font-medium">Voice Introduction Available</span>
          </div>
          <p className="mt-1 text-xs text-blue-600">
            Click the Simon bow tie logo above to hear the voice introduction.
          </p>
        </div>
      )}
    </div>
  )
}
