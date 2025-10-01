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
  audioElement: HTMLAudioElement | null;
}

export function useTTS({
  onPlaybackComplete,
  onPlaybackStart,
  onError,
}: UseTTSOptions = {}): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Use refs for callbacks to avoid recreating playText on every callback change
  const callbacksRef = useRef({ onPlaybackComplete, onPlaybackStart, onError });
  callbacksRef.current = { onPlaybackComplete, onPlaybackStart, onError };

  const playText = useCallback(async (text: string) => {
    try {
      setError(null);
      
      // Stop any existing playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Convert text to speech FIRST
      const { audioUrl } = await convertTextToSpeech(text);
      
      // Create audio element
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setAudioElement(audio);
      
      // Set up event handlers BEFORE setting isPlaying
      audio.onended = () => {
        setIsPlaying(false);
        setAudioElement(null);
        callbacksRef.current.onPlaybackComplete?.();
      };
      
      audio.onerror = (e) => {
        const errorMessage = 'Failed to play audio';
        setError(errorMessage);
        setIsPlaying(false);
        setAudioElement(null);
        callbacksRef.current.onError?.(new Error(errorMessage));
      };
      
      // Set isPlaying BEFORE starting playback
      setIsPlaying(true);
      await audio.play();
      
      // Call onPlaybackStart when audio successfully starts playing
      callbacksRef.current.onPlaybackStart?.();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'TTS failed';
      setError(errorMessage);
      setIsPlaying(false);
      setAudioElement(null);
      callbacksRef.current.onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setAudioElement(null);
  }, []);

  return {
    isPlaying,
    playText,
    stopPlayback,
    error,
    audioElement,
  };
}

