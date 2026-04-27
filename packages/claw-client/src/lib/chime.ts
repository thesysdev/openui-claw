/**
 * Tiny WebAudio chime — a quick two-note ping used as the
 * "assistant finished" notification. No asset needed; a 220ms
 * synthesized tone keeps the bundle clean.
 *
 * `playCompletionChime()` is a no-op when:
 *  - `prefs.notificationSound` is off (caller must check before calling).
 *  - the AudioContext can't be created (older Safari, locked iframes).
 *  - the document is currently visible AND focused — only fire when the
 *    user has tabbed away. This prevents the foreground case where a
 *    sound on every reply would be obnoxious.
 *
 * The AudioContext is lazy + cached so we don't allocate on every check.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function isTabHidden(): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return true;
  // hasFocus is true even when the tab is in another desktop window — treat
  // unfocused-but-visible as still active. We only chime when the user is
  // actually away.
  return document.hidden === true;
}

export function playCompletionChime(): void {
  const audio = getCtx();
  if (!audio) return;
  // Safari sometimes leaves the context suspended until a user gesture; try
  // resuming, but ignore the rejection if the page never had a gesture.
  if (audio.state === "suspended") {
    audio.resume().catch(() => {});
  }

  const now = audio.currentTime;
  const tone = (frequency: number, start: number, duration: number) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.05);
  };

  tone(880, 0, 0.18);
  tone(1318.5, 0.12, 0.22);
}
