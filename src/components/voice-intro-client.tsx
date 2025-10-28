"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/use-tts";
import { BarVisualizer } from "@/components/ui/bar-visualizer";
import { type Hotel } from "@/db/schemas/hotels";
import { useAudioStream } from "@/hooks/use-audio-stream";

type VoiceIntroClientProps = {
  hotel: Hotel;
};

// Detect if device is iOS or Safari
const isIOS = () => {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const isSafari = () => {
  if (typeof window === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export default function VoiceIntroClient({ hotel }: VoiceIntroClientProps) {
  const router = useRouter();
  const hasStartedRef = useRef(false);
  const [showTapPrompt, setShowTapPrompt] = useState(false);
  const [audioPreloaded, setAudioPreloaded] = useState(false);
  const isIOSOrSafari = isSafari() || isIOS();

  const introText = `Hi, I'm Simon—your 24/7 concierge at ${hotel.name}. I can help with hotel amenities, great places to eat, and things to do around the city. If you are hungry, I can also place food-delivery orders from a variety of our partner restaurants. ${hotel.name} encourages you to place food orders through me, so that I can coordinate with the front desk to ensure your meal comes straight to your room. How can I help today?`;

  const {
    preloadAndPlay,
    playPreloadedAudio,
    preloadAudio,
    stopPlayback,
    isPlaying,
    audioElement,
    isPreloaded,
    getCurrentAudio,
  } = useTTS({
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
  // Fallback: if audioElement is null but we have a ref, use the ref
  const fallbackAudioElement = audioElement || getCurrentAudio();

  const audioStream = useAudioStream(fallbackAudioElement);

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const initializeAudio = async () => {
      try {
        if (isIOSOrSafari) {
          await preloadAudio(introText);
          setAudioPreloaded(true);
          setShowTapPrompt(true);
        } else {
          try {
            await preloadAndPlay(introText);
          } catch (_error) {
            setShowTapPrompt(true);
          }
        }
      } catch (_error) {
        setShowTapPrompt(true);
      }
    };

    void initializeAudio();

    return () => {
      // Stop playback only on actual unmount (navigation away)
      stopPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTapToStart = async () => {
    setShowTapPrompt(false);
    if (audioPreloaded && isPreloaded) {
      await playPreloadedAudio();
    } else {
      await preloadAndPlay(introText);
    }
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

              <div className="relative z-10">
                <BarVisualizer
                  state={isPlaying ? "speaking" : "connecting"}
                  barCount={7}
                  mediaStream={audioStream}
                  centerAlign={true}
                  minHeight={20}
                  maxHeight={100}
                  barColor="bg-white"
                  className="bg-transparent"
                />
              </div>
            </div>
            <div className="mt-4 text-sm text-black/80">
              {isPlaying
                ? "Speaking..."
                : isPreloaded
                  ? "Ready to start..."
                  : "Simon is connecting..."}
            </div>
          </div>

          {/* Tap to start overlay - shown on iOS or when autoplay fails */}
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
