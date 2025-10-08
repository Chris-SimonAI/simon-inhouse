'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Options for configuring user audio visualization
 */
export interface UseUserAudioVisualizationOptions {
  /** Whether the user is currently speaking (listening state) */
  isListening: boolean;
  /** Number of frequency bars to display (default: 7) */
  barCount?: number;
  /** FFT size for frequency analysis (default: 256) */
  fftSize?: number;
  /** Smoothing time constant (0-1, default: 0.8) */
  smoothing?: number;
  /** Minimum normalized height (0-1, default: 0.2) */
  minHeight?: number;
  /** Maximum normalized height (0-1, default: 1.0) */
  maxHeight?: number;
}

/**
 * Return value from useUserAudioVisualization hook
 */
export interface UseUserAudioVisualizationReturn {
  /** Array of normalized bar heights (0-1) arranged from center outward */
  barHeights: number[];
}

/**
 * Custom hook for real-time user audio frequency visualization
 * 
 * Creates a symmetric waveform visualization from center outward based on user's microphone input.
 * Uses Web Audio API to analyze frequency data and map it to visual bars.
 * 
 * @example
 * ```tsx
 * const { barHeights } = useUserAudioVisualization({
 *   isListening: true,
 *   barCount: 7,
 *   fftSize: 256,
 *   smoothing: 0.8,
 * });
 * 
 * return (
 *   <div className="flex gap-2 items-center">
 *     {barHeights.map((height, i) => (
 *       <div
 *         key={i}
 *         className="w-1 bg-black rounded-full"
 *         style={{ height: `${height * 60}px` }}
 *       />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useUserAudioVisualization({
  isListening,
  barCount = 7,
  fftSize = 256,
  smoothing = 0.8,
  minHeight = 0.2,
  maxHeight = 1.0,
}: UseUserAudioVisualizationOptions): UseUserAudioVisualizationReturn {
  const [barHeights, setBarHeights] = useState<number[]>(
    Array(barCount).fill(minHeight)
  );

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isListening) {
      // Reset to default heights when not listening
      setBarHeights(Array(barCount).fill(minHeight));
      return;
    }

    let rafId: number | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;

    const startUserAudioVisualization = async () => {
      try {
        // Get user's microphone
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        streamRef.current = stream;

        // Create audio context and analyser
        const AudioContextClass: typeof AudioContext =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothing;
        analyserRef.current = analyser;

        // Connect microphone to analyser
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const animate = () => {
          if (!analyser) return;

          analyser.getByteFrequencyData(dataArray);

          // Split frequency data into bands
          const bandSize = Math.floor(dataArray.length / barCount);
          const frequencyHeights = Array(barCount)
            .fill(0)
            .map((_, i) => {
              let sum = 0;
              const start = i * bandSize;
              const end = Math.min(start + bandSize, dataArray.length);
              for (let j = start; j < end; j++) {
                sum += dataArray[j];
              }
              const avg = sum / (end - start);
              // Normalize to minHeight - maxHeight range
              const normalized = avg / 255;
              return Math.max(
                minHeight,
                Math.min(maxHeight, minHeight + normalized * (maxHeight - minHeight))
              );
            });

          // Rearrange bars from center outward for symmetric effect
          const centerIndex = Math.floor(barCount / 2);
          const newHeights = Array(barCount)
            .fill(0)
            .map((_, i) => {
              const distanceFromCenter = Math.abs(i - centerIndex);
              return frequencyHeights[distanceFromCenter] || minHeight;
            });

          setBarHeights(newHeights);
          rafId = requestAnimationFrame(animate);
          rafIdRef.current = rafId;
        };

        animate();
      } catch (error) {
        console.error('User audio visualization error:', error);
        // Fallback to simple pulse animation
        let frame = 0;
        const fallbackAnimate = () => {
          frame++;
          const newHeights = Array(barCount)
            .fill(0)
            .map((_, i) => {
              const offset = (frame + i * 10) * 0.05;
              return minHeight + Math.sin(offset) * (maxHeight - minHeight) * 0.5;
            });
          setBarHeights(newHeights);
          rafId = requestAnimationFrame(fallbackAnimate);
          rafIdRef.current = rafId;
        };
        fallbackAnimate();
      }
    };

    startUserAudioVisualization();

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafIdRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [isListening, barCount, fftSize, smoothing, minHeight, maxHeight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    barHeights,
  };
}
