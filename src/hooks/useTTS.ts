'use client';

import { useCallback, useRef, useState } from 'react';
import { convertTextToSpeech } from '@/actions/voice';

export interface UseTTSOptions {
  onPlaybackComplete?: () => void;
  onPlaybackStart?: () => void; // New callback for when audio starts playing
  onError?: (error: Error) => void;
}

export interface UseTTSReturn {
  isPlaying: boolean;
  playText: (text: string) => Promise<void>;
  stopPlayback: () => void;
  error: string | null;
}

export function useTTS({
  onPlaybackComplete,
  onPlaybackStart,
  onError,
}: UseTTSOptions = {}): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playText = useCallback(async (text: string) => {
    try {
      setError(null);
      setIsPlaying(true);
      
      // Stop any existing playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Convert text to speech
      const { audioUrl } = await convertTextToSpeech(text);
      
      // Create and play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        onPlaybackComplete?.();
      };
      
      audio.onerror = () => {
        const errorMessage = 'Failed to play audio';
        setError(errorMessage);
        setIsPlaying(false);
        onError?.(new Error(errorMessage));
      };
      
      await audio.play();
      
      // Call onPlaybackStart when audio successfully starts playing
      onPlaybackStart?.();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'TTS failed';
      setError(errorMessage);
      setIsPlaying(false);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [onPlaybackComplete, onPlaybackStart, onError]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    playText,
    stopPlayback,
    error,
  };
}

