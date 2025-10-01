'use client';

import { useEffect, useState } from 'react';

/**
 * Options for configuring audio visualization
 */
export interface UseAudioVisualizationOptions {
  /** The HTML audio element to visualize */
  audioElement: HTMLAudioElement | null;
  /** Whether audio is currently playing */
  isPlaying: boolean;
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
 * Return value from useAudioVisualization hook
 */
export interface UseAudioVisualizationReturn {
  /** Array of normalized bar heights (0-1) arranged from center outward */
  barHeights: number[];
}

/**
 * Custom hook for real-time audio frequency visualization
 * 
 * Creates a symmetric waveform visualization from center outward based on audio frequencies.
 * Uses Web Audio API to analyze frequency data and map it to visual bars.
 * 
 * @example
 * ```tsx
 * const { barHeights } = useAudioVisualization({
 *   audioElement,
 *   isPlaying,
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
 *         className="w-1 bg-white rounded-full"
 *         style={{ height: `${height * 60}px` }}
 *       />
 *     ))}
 *   </div>
 * );
 * ```
 */

export function useAudioVisualization({
  audioElement,
  isPlaying,
  barCount = 7,
  fftSize = 256,
  smoothing = 0.8,
  minHeight = 0.2,
  maxHeight = 1.0,
}: UseAudioVisualizationOptions): UseAudioVisualizationReturn {
  const [barHeights, setBarHeights] = useState<number[]>(
    Array(barCount).fill(minHeight)
  );

  useEffect(() => {
    if (!isPlaying || !audioElement) {
      // Reset to default heights when not playing
      setBarHeights(Array(barCount).fill(minHeight));
      return;
    }

    let rafId: number | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;

    try {
      // Create audio context and analyser
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = smoothing;

      // Connect audio element to analyser
      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(audioContext.destination);

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
      };

      animate();
    } catch (error) {
      console.error('Audio visualization error:', error);
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
      };
      fallbackAnimate();
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    };
  }, [isPlaying, audioElement, barCount, fftSize, smoothing, minHeight, maxHeight]);

  return {
    barHeights,
  };
}
