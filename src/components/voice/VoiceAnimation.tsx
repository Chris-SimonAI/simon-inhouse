"use client";

import { VoiceStatus as VoiceStatusType } from "@/hooks/useVoiceAgentConnection";
import { BarVisualizer } from "@/components/ui/bar-visualizer";
import { useAudioStream, useMicrophoneStream } from "@/hooks/useAudioStream";

interface VoiceAnimationProps {
  status: VoiceStatusType;
  isConnecting: boolean;
  audioElement?: HTMLAudioElement | null;
}

export function VoiceAnimation({ status, isConnecting, audioElement }: VoiceAnimationProps) {
  // Convert audio element to stream for speaking/processing visualization
  const audioStream = useAudioStream(audioElement ?? null);
  
  // Get microphone stream for listening state
  const micStream = useMicrophoneStream(status === 'listening');
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

          {/* BarVisualizer for connecting state */}
          <div className="relative z-10">
            <BarVisualizer
              state="connecting"
              barCount={7}
              demo={true}
              centerAlign={true}
              minHeight={20}
              maxHeight={100}
              barColor="bg-white"
              className="bg-transparent"
            />
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

            {/* BarVisualizer for listening state (user microphone) */}
            <div className="relative z-10">
              <BarVisualizer
                state="listening"
                barCount={7}
                mediaStream={micStream}
                centerAlign={true}
                minHeight={20}
                maxHeight={100}
                barColor="bg-black"
                className="bg-transparent"
              />
            </div>
          </div>
        );
      case "processing":
        return (
          <div className="w-40 h-40 rounded-full bg-blue-500 flex items-center justify-center relative overflow-hidden">
            {/* BarVisualizer for processing state */}
            <div className="relative z-10">
              <BarVisualizer
                state="thinking"
                barCount={7}
                demo={true}
                centerAlign={true}
                minHeight={20}
                maxHeight={100}
                barColor="bg-white"
                className="bg-transparent"
              />
            </div>
          </div>
        );
      case "speaking":
        return (
          <div className="w-40 h-40 rounded-full bg-black flex items-center justify-center relative overflow-hidden">
            {/* BarVisualizer for speaking state */}
            <div className="relative z-10">
              <BarVisualizer
                state="speaking"
                barCount={7}
                mediaStream={audioStream}
                demo={!audioStream}
                centerAlign={true}
                minHeight={20}
                maxHeight={70}
                barColor="bg-white"
                className="bg-transparent"
              />
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
