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
  playPreloadedAudio: () => Promise<void>;
  preloadAudio: (text: string) => Promise<void>;
  preloadAndPlay: (text: string) => Promise<void>;
  stopPlayback: () => void;
  error: string | null;
  audioElement: HTMLAudioElement | null;
  isPreloaded: boolean;
  getCurrentAudio: () => HTMLAudioElement | null;
}

export function useTTS({
  onPlaybackComplete,
  onPlaybackStart,
  onError,
}: UseTTSOptions = {}): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedAudioRef = useRef<HTMLAudioElement | null>(null);
  
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
      
      audio.onerror = () => {
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

  const preloadAudio = useCallback(async (text: string) => {
    try {
      setError(null);
      
      // Convert text to speech
      const { audioUrl } = await convertTextToSpeech(text);
      
      // Create and preload audio element
      const audio = new Audio(audioUrl);
      preloadedAudioRef.current = audio;
      setIsPreloaded(true);
      
      // Set up event handlers for preloaded audio
      audio.onended = () => {
        setIsPlaying(false);
        setAudioElement(null);
        callbacksRef.current.onPlaybackComplete?.();
      };
      
      audio.onerror = () => {
        const errorMessage = 'Failed to play preloaded audio';
        setError(errorMessage);
        setIsPlaying(false);
        setAudioElement(null);
        callbacksRef.current.onError?.(new Error(errorMessage));
      };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'TTS preload failed';
      setError(errorMessage);
      setIsPreloaded(false);
      callbacksRef.current.onError?.(err instanceof Error ? err : new Error(errorMessage));
      throw err;
    }
  }, []);

  const playPreloadedAudio = useCallback(async () => {
    if (!preloadedAudioRef.current || !isPreloaded) {
      throw new Error('No preloaded audio available');
    }

    try {
      setError(null);
      
      // Stop any existing playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Use the preloaded audio
      audioRef.current = preloadedAudioRef.current;
      setAudioElement(preloadedAudioRef.current);
      
      // Set isPlaying BEFORE starting playback
      setIsPlaying(true);
      await preloadedAudioRef.current.play();
      
      // Call onPlaybackStart when audio successfully starts playing
      callbacksRef.current.onPlaybackStart?.();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to play preloaded audio';
      setError(errorMessage);
      setIsPlaying(false);
      setAudioElement(null);
      callbacksRef.current.onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [isPreloaded]);

  const preloadAndPlay = useCallback(async (text: string) => {
    try {
      setError(null);
      // Stop any existing playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Convert text to speech
      const { audioUrl } = await convertTextToSpeech(text);
      
      // Create audio element
      const audio = new Audio(audioUrl);
      
      // Set up event handlers BEFORE setting state
      audio.onended = () => {
        setIsPlaying(false);
        setAudioElement(null);
        callbacksRef.current.onPlaybackComplete?.();
      };
      
      audio.onerror = () => {
        const errorMessage = 'Failed to play audio';
        setError(errorMessage);
        setIsPlaying(false);
        setAudioElement(null);
        callbacksRef.current.onError?.(new Error(errorMessage));
      };
      
      // Set up audio for iOS compatibility
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      
      // Set refs and state
      audioRef.current = audio;
      preloadedAudioRef.current = audio;
      setAudioElement(audio);
      setIsPreloaded(true);
      
      // Set isPlaying BEFORE starting playback
      setIsPlaying(true);
      
      // For iOS, we need to handle the play promise
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      
      // Call onPlaybackStart when audio successfully starts playing
      callbacksRef.current.onPlaybackStart?.();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'TTS failed';
      setError(errorMessage);
      setIsPlaying(false);
      setAudioElement(null);
      setIsPreloaded(false);
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

  const getCurrentAudio = useCallback(() => {
    return audioRef.current;
  }, []);

  return {
    isPlaying,
    playText,
    playPreloadedAudio,
    preloadAudio,
    preloadAndPlay,
    stopPlayback,
    error,
    audioElement,
    isPreloaded,
    getCurrentAudio,
  };
}

