"use client";

/**
 * Speech-to-text via the browser's `SpeechRecognition` API.
 *
 * Returns:
 *   - `supported`  — false on browsers without webkitSpeechRecognition (e.g. Firefox)
 *   - `listening`  — currently capturing audio
 *   - `start(onText)` — begins recognition; emits final + interim text via the callback
 *   - `stop()`     — manually halt
 *
 * We deliberately do NOT manage the textarea state here; the caller
 * decides how to fold incoming text into existing input (append vs.
 * replace, trimming, etc.).
 *
 * The fallback path (MediaRecorder → server-side STT) is intentionally
 * out of scope: the gateway has no upload-and-transcribe RPC yet, and
 * shipping a fragile fallback that silently fails is worse than just
 * hiding the button.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechToText() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() != null);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback((onText: (text: string, isFinal: boolean) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    // Tear down any prior session before starting a new one — Chrome
    // throws InvalidStateError if `start()` is called on an already-running
    // recognition instance.
    recognitionRef.current?.abort();

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onresult = (event) => {
      let combined = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i];
        combined += r[0].transcript;
      }
      const lastIsFinal =
        event.results[event.results.length - 1]?.isFinal ?? false;
      onText(combined, lastIsFinal);
    };
    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, start, stop };
}
