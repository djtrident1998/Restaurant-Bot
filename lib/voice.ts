// Voice input using the browser's built-in speech recognition (Web Speech API). Free, no API key, no server cost:
// the browser (Chrome, Edge, Safari) transcribes; we only receive text. Browser-safe, framework-free and unit-testable.

export interface RecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}
export interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionCtor = new () => RecognitionLike;

/** The browser's SpeechRecognition constructor, or null when voice input isn't available (e.g. Firefox). */
export function getRecognitionCtor(w: unknown = typeof window === "undefined" ? undefined : window): RecognitionCtor | null {
  const g = w as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } | undefined;
  return g?.SpeechRecognition ?? g?.webkitSpeechRecognition ?? null;
}

export const MAX_VOICE_CHARS = 400; // same as the server's default message limit (LIMIT_INPUT_CHARS)

/** Tidy a transcript: collapse whitespace, trim, cap at the same length the text box allows. */
export function cleanTranscript(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, MAX_VOICE_CHARS);
}

export function friendlyVoiceError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.";
    case "no-speech":
      return "I didn't catch anything. Tap the microphone and try again.";
    case "audio-capture":
      return "No microphone was found. Check that one is connected.";
    case "network":
      return "Voice recognition needs an internet connection. Please try again, or type your message.";
    case "language-not-supported":
      return "That language isn't supported for voice input. Please type your message.";
    case "aborted":
      return "";
    default:
      return "Voice input hit a problem. Please try again, or type your message.";
  }
}

export interface VoiceHandlers {
  onStart?: () => void;
  /** Live text while the person is still speaking. */
  onInterim?: (text: string) => void;
  /** The finished sentence (final result). */
  onFinal: (text: string) => void;
  /** Speech ended without a final result but some words were heard — let the person review/edit them. */
  onLeftover?: (text: string) => void;
  onError?: (code: string, message: string) => void;
  onEnd?: () => void;
}

export interface VoiceSession {
  start(): void;
  stop(): void;
  readonly listening: boolean;
}

export function createVoiceSession(Ctor: RecognitionCtor, lang: string, h: VoiceHandlers): VoiceSession {
  let rec: RecognitionLike | null = null;
  let listening = false;
  let delivered = false; // a final transcript was passed on
  let heard = ""; // latest interim text, in case recognition ends without a final result
  let errored = false;

  return {
    get listening() {
      return listening;
    },
    start() {
      if (listening) return; // ignore double taps
      delivered = false;
      heard = "";
      errored = false;
      rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false; // one utterance per tap
      rec.interimResults = true; // show words as they are spoken
      rec.maxAlternatives = 1;
      rec.onstart = () => {
        listening = true;
        h.onStart?.();
      };
      rec.onresult = (e) => {
        let text = "";
        let isFinal = false;
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0]?.transcript ?? "";
          if (e.results[i].isFinal) isFinal = true;
        }
        const cleaned = cleanTranscript(text);
        if (!cleaned) return;
        if (isFinal) {
          if (delivered) return; // never send the same utterance twice
          delivered = true;
          h.onFinal(cleaned);
        } else {
          heard = cleaned;
          h.onInterim?.(cleaned);
        }
      };
      rec.onerror = (e) => {
        errored = true;
        const msg = friendlyVoiceError(e.error);
        if (msg) h.onError?.(e.error, msg);
      };
      rec.onend = () => {
        listening = false;
        if (!delivered && !errored && heard) h.onLeftover?.(heard);
        h.onEnd?.();
        rec = null;
      };
      try {
        rec.start();
      } catch {
        listening = false;
        h.onError?.("start-failed", friendlyVoiceError("other"));
      }
    },
    stop() {
      rec?.stop(); // lets the browser finish transcribing what was already said
    },
  };
}
