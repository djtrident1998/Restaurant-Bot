// Offline: the voice engine against a fake SpeechRecognition (no microphone, no browser, no network).
import { cleanTranscript, createVoiceSession, friendlyVoiceError, getRecognitionCtor, MAX_VOICE_CHARS, type RecognitionCtor, type RecognitionLike } from "../lib/voice";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

class FakeRec implements RecognitionLike {
  static last: FakeRec | null = null;
  static throwOnStart = false;
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 0;
  onstart: RecognitionLike["onstart"] = null;
  onresult: RecognitionLike["onresult"] = null;
  onerror: RecognitionLike["onerror"] = null;
  onend: RecognitionLike["onend"] = null;
  started = 0;
  constructor() {
    FakeRec.last = this;
  }
  start() {
    if (FakeRec.throwOnStart) throw new Error("already started");
    this.started++;
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  abort() {}
  // helpers to simulate the browser
  say(parts: { t: string; final: boolean }[]) {
    this.onresult?.({ resultIndex: 0, results: parts.map((p) => Object.assign([{ transcript: p.t }], { isFinal: p.final, length: 1 })) as never });
  }
  fail(code: string) {
    this.onerror?.({ error: code });
    this.onend?.();
  }
}
const Ctor = FakeRec as unknown as RecognitionCtor;

function collect() {
  const log = { start: 0, interim: [] as string[], final: [] as string[], leftover: [] as string[], errors: [] as string[], end: 0 };
  const session = createVoiceSession(Ctor, "en-IN", {
    onStart: () => log.start++,
    onInterim: (t) => log.interim.push(t),
    onFinal: (t) => log.final.push(t),
    onLeftover: (t) => log.leftover.push(t),
    onError: (c, m) => log.errors.push(`${c}:${m}`),
    onEnd: () => log.end++,
  });
  return { log, session };
}

// ---- detection ----
check("no recognizer -> null (e.g. Firefox)", getRecognitionCtor({}) === null && getRecognitionCtor(undefined) === null);
check("standard SpeechRecognition found", getRecognitionCtor({ SpeechRecognition: Ctor }) === Ctor);
check("webkit-prefixed SpeechRecognition found (Chrome/Safari)", getRecognitionCtor({ webkitSpeechRecognition: Ctor }) === Ctor);

// ---- transcript cleaning ----
check("whitespace collapsed and trimmed", cleanTranscript("  show   me \n the  menu ") === "show me the menu");
check("capped at the text box limit", cleanTranscript("a".repeat(MAX_VOICE_CHARS + 500)).length === MAX_VOICE_CHARS);
check("empty / blank stays empty", cleanTranscript("   ") === "");

// ---- a normal utterance: words appear live, then the sentence is delivered once ----
{
  const { log, session } = collect();
  session.start();
  const rec = FakeRec.last!;
  check("configured for one utterance with live words in the right language", rec.continuous === false && rec.interimResults === true && rec.lang === "en-IN" && rec.maxAlternatives === 1);
  check("start callback fired and session is listening", log.start === 1 && session.listening);
  rec.say([{ t: "show me", final: false }]);
  rec.say([{ t: "show me the menu", final: false }]);
  check("live (interim) text streamed", log.interim.join("|") === "show me|show me the menu");
  rec.say([{ t: "show me the menu", final: true }]);
  check("final sentence delivered", log.final.join("|") === "show me the menu");
  rec.say([{ t: "show me the menu", final: true }]);
  check("the same utterance is never delivered twice", log.final.length === 1);
  rec.stop();
  check("session ends cleanly and stops listening", log.end === 1 && !session.listening && log.errors.length === 0 && log.leftover.length === 0);
}

// ---- double tap while listening is ignored ----
{
  const { log, session } = collect();
  session.start();
  const first = FakeRec.last!;
  session.start();
  check("second start while listening is ignored", FakeRec.last === first && first.started === 1 && log.start === 1);
}

// ---- stopping early: heard words but no final result -> handed back for review, not lost or auto-sent ----
{
  const { log, session } = collect();
  session.start();
  FakeRec.last!.say([{ t: "add two chana", final: false }]);
  session.stop();
  check("words heard but not finalised are returned for review", log.leftover.join("|") === "add two chana" && log.final.length === 0);
}

// ---- errors ----
for (const code of ["not-allowed", "no-speech", "audio-capture", "network"]) {
  const { log, session } = collect();
  session.start();
  FakeRec.last!.fail(code);
  check(`error "${code}" -> friendly message, nothing sent`, log.errors.length === 1 && log.errors[0].startsWith(code + ":") && log.errors[0].length > code.length + 10 && log.final.length === 0 && !session.listening);
}
check("deliberate abort shows no error text", friendlyVoiceError("aborted") === "");
check("unknown error gets a generic friendly message", /problem/i.test(friendlyVoiceError("weird-code")));
{
  const { log, session } = collect();
  session.start();
  FakeRec.last!.say([{ t: "hello", final: false }]);
  FakeRec.last!.fail("network");
  check("after an error, partial words are NOT treated as leftover", log.leftover.length === 0);
}

// ---- recognizer that refuses to start ----
{
  FakeRec.throwOnStart = true;
  const { log, session } = collect();
  session.start();
  FakeRec.throwOnStart = false;
  check("start() throwing is reported, not crashed", log.errors.length === 1 && !session.listening);
}

// ---- can start again after finishing ----
{
  const { log, session } = collect();
  session.start();
  FakeRec.last!.say([{ t: "first", final: true }]);
  FakeRec.last!.stop();
  session.start();
  FakeRec.last!.say([{ t: "second", final: true }]);
  check("a second utterance works after the first", log.final.join("|") === "first|second");
}

process.exit(fails ? 1 : 0);
