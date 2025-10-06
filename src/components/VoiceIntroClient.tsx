"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";
import { useAudioVisualization } from "@/hooks/useAudioVisualization";
import { type Hotel } from "@/db/schemas/hotels";

type VoiceIntroClientProps = {
  hotel: Hotel;
};

export default function VoiceIntroClient({ hotel }: VoiceIntroClientProps) {
  const router = useRouter();
  const hasStartedRef = useRef(false);

  const introText = `Hi, I'm Simon—your 24/7 concierge at ${hotel.name}. I can help with hotel amenities, great places to eat, and things to do around the city. If you are hungry, I can also place food-delivery orders from a variety of our partner restaurants. ${hotel.name} encourages you to place food orders through me, so that I can coordinate with the front desk to ensure your meal comes straight to your room. How can I help today?`;

  const { playText, stopPlayback, isPlaying, audioElement } = useTTS({
    onPlaybackComplete: () => {
      // Mark as played and return to home
      const maxAge = 100 * 365 * 24 * 60 * 60; // 100 years
      document.cookie = `simon-intro-played=true; max-age=${maxAge}; path=/`;
      router.replace("/");
    },
  });

  // Audio visualization using custom hook
  const { barHeights } = useAudioVisualization({
    audioElement,
    isPlaying,
    barCount: 7,
    fftSize: 256,
    smoothing: 0.8,
    minHeight: 0.2,
    maxHeight: 1.0,
  });

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const clickHandlerRef = {
      current: undefined as
        | ((this: Window, ev: MouseEvent) => void)
        | undefined,
    };

    const tryStart = async () => {
      try {
        await playText(introText);
      } catch {
        // If autoplay fails, require a user gesture
        const onTap = () => {
          playText(introText).finally(() => {
            if (clickHandlerRef.current) {
              window.removeEventListener("click", clickHandlerRef.current);
            }
          });
        };
        clickHandlerRef.current = onTap;
        window.addEventListener("click", onTap);
      }
    };
    void tryStart();

    return () => {
      // Stop playback only on actual unmount (navigation away)
      stopPlayback();
      if (clickHandlerRef.current) {
        window.removeEventListener("click", clickHandlerRef.current);
        clickHandlerRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-dvh w-full bg-gray-50">
      <div className="h-dvh w-full flex justify-center">
        <div className="h-dvh w-full max-w-md flex items-center justify-center bg-white">
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
        </div>
      </div>
    </div>
  );
}
