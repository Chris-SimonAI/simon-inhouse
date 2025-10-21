"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import { useAudioVisualization } from "@/hooks/useAudioVisualization";
import { type Hotel } from "@/db/schemas/hotels";

type VoiceIntroClientProps = {
  hotel: Hotel;
};

// Detect if device is iOS or Safari
const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isSafari = () => {
  if (typeof window === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export default function VoiceIntroClient({ hotel }: VoiceIntroClientProps) {
  const router = useRouter();
  const hasStartedRef = useRef(false);
  const [showTapPrompt, setShowTapPrompt] = useState(false);
  const isSafariOrIOSRef = useRef(isSafari() || isIOS());

  const introText = `Hi, I'm Simon—your 24/7 concierge at ${hotel.name}. I can help with hotel amenities, great places to eat, and things to do around the city. If you are hungry, I can also place food-delivery orders from a variety of our partner restaurants. ${hotel.name} encourages you to place food orders through me, so that I can coordinate with the front desk to ensure your meal comes straight to your room. How can I help today?`;

  const { playText, stopPlayback, isPlaying, audioElement } = useTTS({
    onPlaybackStart: () => {
      setShowTapPrompt(false);
    },
    onPlaybackComplete: () => {
      // Mark as played and return to home
      const maxAge = 100 * 365 * 24 * 60 * 60; // 100 years
      document.cookie = `simon-intro-played=true; max-age=${maxAge}; path=/`;
      router.replace("/");
    },
  });

  // Dummy frequency hook for Safari/iOS (fallback due to Web Audio API issues)
  function useDummyFrequency(barCount: number = 7, isActive: boolean = false) {
    const [barHeights, setBarHeights] = useState<number[]>(
      Array(barCount).fill(0.2)
    );
    const targetHeightsRef = useRef<number[]>(Array(barCount).fill(0.2));

    useEffect(() => {
      if (!isActive) {
        setBarHeights(Array(barCount).fill(0.2));
        targetHeightsRef.current = Array(barCount).fill(0.2);
        return;
      }

      const targetInterval = setInterval(() => {
        targetHeightsRef.current = Array(barCount)
          .fill(0)
          .map(() => Math.random() * 0.6 + 0.3);
      }, 500);

      const smoothInterval = setInterval(() => {
        setBarHeights((prev) =>
          prev.map((current, index) => {
            const target = targetHeightsRef.current[index];
            const diff = target - current;
            return current + diff * 0.15;
          })
        );
      }, 30);

      return () => {
        clearInterval(targetInterval);
        clearInterval(smoothInterval);
      };
    }, [isActive, barCount]);

    return barHeights;
  }

  // Use dummy animation for Safari/iOS, real audio visualization for others
  const dummyBarHeights = useDummyFrequency(7, isSafariOrIOSRef.current ? isPlaying : false);
  const { barHeights: realBarHeights } = useAudioVisualization({
    audioElement,
    isPlaying: isSafariOrIOSRef.current ? false : isPlaying,
    barCount: 7,
    fftSize: 256,
    smoothing: 0.8,
    minHeight: 0.2,
    maxHeight: 1.0,
  });

  const barHeights = isSafariOrIOSRef.current ? dummyBarHeights : realBarHeights;

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const tryStart = async () => {
      // On iOS/Safari, show tap prompt immediately instead of trying autoplay
      if (isSafariOrIOSRef.current) {
        setShowTapPrompt(true);
        return;
      }

      // On Android/other devices, try autoplay
      try {
        await playText(introText);
      } catch {
        // If autoplay fails on non-iOS, show prompt too
        setShowTapPrompt(true);
      }
    };
    void tryStart();

    return () => {
      // Stop playback only on actual unmount (navigation away)
      stopPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTapToStart = () => {
    setShowTapPrompt(false);
    void playText(introText);
  };

  return (
    <div className="h-dvh w-full bg-gray-50">
      <div className="h-dvh w-full flex justify-center">
        <div className="h-dvh w-full max-w-md flex items-center justify-center bg-white relative">
          <div className="flex flex-col items-center">
            <div className="text-sm font-semibold text-black mb-4">Simon</div>
            <div className="w-40 h-40 rounded-full bg-black flex items-center justify-center relative overflow-hidden">
              {!isPlaying && (
                // Enhanced circular border loader when not playing (loading state)
                <>
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
                </>
              )}

              <div className="flex gap-1.5 items-center relative z-10 h-16">
                {barHeights.map((height, i) => (
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
            <div className="mt-4 text-sm text-black/80">
              {isPlaying ? "Speaking..." : "Simon is connecting..."}
            </div>
          </div>

          {/* Tap to start overlay - only shown on iOS or when autoplay fails */}
          {showTapPrompt && (
            <div className="absolute inset-0 bg-white/95 flex items-center justify-center z-20">
              <button
                onClick={handleTapToStart}
                className="px-8 py-4 bg-black text-white rounded-full text-lg font-semibold hover:bg-gray-800 active:scale-95 transition-all"
              >
                Tap to Start
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
