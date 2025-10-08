"use client";

import { VoiceStatus as VoiceStatusType } from "@/hooks/useVoiceAgentConnection";
import { useAudioVisualization } from "@/hooks/useAudioVisualization";
import { useUserAudioVisualization } from "@/hooks/useUserAudioVisualization";
import { useState, useEffect } from "react";

// Custom hook for dummy frequency data with smooth waveform-like animation
function useDummyFrequency(barCount: number = 7, isActive: boolean = false) {
  const [barHeights, setBarHeights] = useState<number[]>(Array(barCount).fill(0.2));
  const [targetHeights, setTargetHeights] = useState<number[]>(Array(barCount).fill(0.2));

  useEffect(() => {
    if (!isActive) {
      setBarHeights(Array(barCount).fill(0.2));
      setTargetHeights(Array(barCount).fill(0.2));
      return;
    }

    // Set new target heights every 500ms for faster changes
    const targetInterval = setInterval(() => {
      setTargetHeights(prev => 
        prev.map(() => Math.random() * 0.6 + 0.3) // Target heights between 0.3 and 0.9
      );
    }, 500);

    // Smooth interpolation every 30ms for more responsive animation
    const smoothInterval = setInterval(() => {
      setBarHeights(prev => 
        prev.map((current, index) => {
          const target = targetHeights[index];
          const diff = target - current;
          // Faster interpolation with easing
          return current + diff * 0.15;
        })
      );
    }, 30);

    return () => {
      clearInterval(targetInterval);
      clearInterval(smoothInterval);
    };
  }, [isActive, barCount, targetHeights]);

  return barHeights;
}

interface VoiceAnimationProps {
  status: VoiceStatusType;
  isConnecting: boolean;
  audioElement?: HTMLAudioElement | null;
  isPlaying?: boolean;
}

export function VoiceAnimation({ status, isConnecting, audioElement, isPlaying }: VoiceAnimationProps) {
  // Audio visualization for Simon's voice (speaking/processing states)
  const { barHeights: simonBarHeights } = useAudioVisualization({
    audioElement: audioElement ?? null,
    isPlaying: isPlaying || false,
    barCount: 7,
    fftSize: 256,
    smoothing: 0.8,
    minHeight: 0.2,
    maxHeight: 1.0,
  });

  // User audio visualization for listening state
  const { barHeights: userBarHeights } = useUserAudioVisualization({
    isListening: status === 'listening',
    barCount: 7,
    fftSize: 256,
    smoothing: 0.8,
    minHeight: 0.2,
    maxHeight: 1.0,
  });

  // Dummy frequency data for speaking state
  const dummyBarHeights = useDummyFrequency(7, status === 'speaking');

  // Static bar heights for connecting state
  const staticBarHeights = Array(7).fill(0.3);
  const renderAnimation = () => {
    if (isConnecting) {
      return (
        <div className="w-40 h-40 rounded-full bg-black flex items-center justify-center relative overflow-hidden">
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full border-[3px] border-white/10"></div>

          {/* Spinning gradient border */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0%, transparent 70%, white 100%)",
              animation: "spin 1.5s linear infinite",
            }}
          ></div>

          {/* Inner mask to create border effect */}
          <div className="absolute inset-[3px] rounded-full bg-black"></div>

          {/* Static bars for connecting state */}
          <div className="flex gap-1.5 items-center relative z-10 h-16">
            {staticBarHeights.map((height, i) => (
              <div
                key={i}
                className="w-1 bg-white rounded-full transition-all duration-75 ease-out"
                style={{
                  height: `${height * 60}px`,
                  minHeight: '8px',
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    switch (status) {
      case "listening":
        return (
          <div className="w-40 h-40 rounded-full bg-black flex items-center justify-center relative overflow-hidden">
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full border-[3px] border-white/10"></div>

            {/* Spinning gradient border */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0%, transparent 70%, black 100%)",
                animation: "spin 1.5s linear infinite",
              }}
            ></div>

            {/* Inner mask to create border effect */}
            <div className="absolute inset-[3px] rounded-full bg-gray-50"></div>

            {/* Dynamic bars for listening state (user speaking) - black bars */}
            <div className="flex gap-1.5 items-center relative z-10 h-16">
              {userBarHeights.map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-black rounded-full transition-all duration-75 ease-out"
                  style={{
                    height: `${height * 60}px`,
                    minHeight: '8px',
                  }}
                />
              ))}
            </div>
          </div>
        );
      case "processing":
        return (
          <div className="w-40 h-40 rounded-full bg-blue-500 flex items-center justify-center relative overflow-hidden">
            {/* Dynamic bars for processing state (LLM processing) - white bars */}
            <div className="flex gap-1.5 items-center relative z-10 h-16">
              {simonBarHeights.map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-white rounded-full transition-all duration-75 ease-out"
                  style={{
                    height: `${height * 60}px`,
                    minHeight: '8px',
                  }}
                />
              ))}
            </div>
          </div>
        );
      case "speaking":
        return (
          <div className="w-40 h-40 rounded-full bg-black flex items-center justify-center relative overflow-hidden">
            {/* Dynamic bars for speaking state (LLM speaking) - white bars with dummy frequency */}
            <div className="flex gap-1.5 items-center relative z-10 h-16">
              {dummyBarHeights.map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-white rounded-full transition-all duration-75 ease-out"
                  style={{
                    height: `${height * 60}px`,
                    minHeight: '8px',
                  }}
                />
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto mb-8 flex items-center justify-center">
      {renderAnimation()}
    </div>
  );
}
