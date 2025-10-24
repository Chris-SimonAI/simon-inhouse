import { useEffect, useRef, useState } from "react";

export function useAudioStream(audioElement: HTMLAudioElement | null) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!audioElement) {
      setStream(null);
      return;
    }

    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = ctx.createMediaElementSource(audioElement);
      const dest = ctx.createMediaStreamDestination();

      source.connect(dest);
      source.connect(ctx.destination);

      contextRef.current = ctx;
      setStream(dest.stream);
    } catch (err) {
      console.error("Audio stream creation failed:", err);
    }

    return () => {
      contextRef.current?.close();
    };
  }, [audioElement]);

  return stream;
}

export function useMicrophoneStream(isListening: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isListening) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
      }
      return;
    }

    let mounted = true;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((mediaStream) => {
        if (mounted) {
          streamRef.current = mediaStream;
          setStream(mediaStream);
        }
      })
      .catch((err) => {
        console.error("Microphone access failed:", err);
      });

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isListening]);

  return stream;
}
