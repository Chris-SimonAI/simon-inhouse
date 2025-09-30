"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTTS } from "@/hooks/useTTS";

const INTRO_TEXT = "Welcome to Hotel Pacifica! I am Simon, your personal concierge. I am here to help during your stay.";

export default function VoiceIntroPlayPage() {
  const router = useRouter();

  const { playText, stopPlayback } = useTTS({
    onPlaybackComplete: () => {
      // Mark as played and return to home
      const maxAge = 24 * 60 * 60; // 1 day
      document.cookie = `simon-intro-played=true; max-age=${maxAge}; path=/`;
      router.replace("/");
    },
  });

  useEffect(() => {
    // React StrictMode mounts/unmounts effects twice in dev; persist guard across runs
    const startedRef = (window as unknown as { __voiceIntroStarted?: boolean });
    const clickHandlerRef = { current: undefined as ((this: Window, ev: MouseEvent) => any) | undefined };
    const tryStart = async () => {
      if (startedRef.__voiceIntroStarted) return;
      startedRef.__voiceIntroStarted = true;
      try {
        await playText(INTRO_TEXT);
      } catch {
        // If autoplay fails, require a user gesture
        const onTap = () => {
          playText(INTRO_TEXT).finally(() => {
            window.removeEventListener("click", onTap);
          });
        };
        clickHandlerRef.current = onTap;
        window.addEventListener("click", onTap);
      }
    };
    void tryStart();

    return () => {
      // Stop any ongoing playback to avoid overlaps when navigating/unmounting
      stopPlayback();
      if (clickHandlerRef.current) {
        window.removeEventListener("click", clickHandlerRef.current);
        clickHandlerRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-start justify-center bg-white pt-20">
      <div className="flex flex-col items-center">
        <div className="text-sm font-semibold text-black mb-4">Simon</div>
        <div className="w-40 h-40 rounded-full bg-black flex items-center justify-center">
          {/* simple dot bar to mirror mock */}
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-white inline-block" />
            ))}
          </div>
        </div>
        <div className="mt-4 text-sm text-black/80">Welcome!</div>
      </div>
    </div>
  );
}
