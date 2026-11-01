"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createVoiceSession, getRecognitionCtor, type VoiceSession } from "@/lib/voice";

interface Options {
  /** Live words while speaking. */
  onInterim: (text: string) => void;
  /** The finished sentence — the caller sends it. */
  onFinal: (text: string) => void;
  /** Speech stopped with words heard but no final result — the caller shows them for review. */
  onLeftover: (text: string) => void;
}

/** Microphone input via the browser's speech recognition. `supported` is false where the browser has none (e.g. Firefox). */
export function useVoiceInput(opts: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const session = useRef<VoiceSession | null>(null);
  const handlers = useRef(opts);

  useEffect(() => {
    handlers.current = opts;
  });

  useEffect(() => {
    // Feature detection can only run in the browser, after mount (keeps server and first client render identical).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const start = useCallback(() => {
    setError("");
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Voice input isn't available in this browser. Try Chrome, Edge or Safari, or type your message.");
      return;
    }
    session.current ??= createVoiceSession(Ctor, navigator.language || "en-IN", {
      onStart: () => setListening(true),
      onInterim: (t) => handlers.current.onInterim(t),
      onFinal: (t) => handlers.current.onFinal(t),
      onLeftover: (t) => handlers.current.onLeftover(t),
      onError: (_code, message) => setError(message),
      onEnd: () => setListening(false),
    });
    session.current.start();
  }, []);

  const stop = useCallback(() => session.current?.stop(), []);

  useEffect(() => () => session.current?.stop(), []);

  return { supported, listening, error, start, stop, clearError: () => setError("") };
}
