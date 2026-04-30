"use client";

import { useEffect, useMemo, useState } from "react";

/** Per-word blur-in timing. Kept here (not in CSS) because the JSX
 *  computes the cumulative `animation-delay` per word and the streaming
 *  effect schedules a `streamDone` flag using the same numbers. */
export const ROTATING_WORD_STAGGER_MS = 80;
export const ROTATING_WORD_ANIM_MS = 460;

export interface PlaceholderToken {
  text: string;
  /** Index among non-whitespace tokens. -1 for whitespace runs — those
   *  render as plain inert spans. */
  wordIndex: number;
}

interface Options {
  /** Strings to cycle through. Empty array disables rotation. */
  items: ReadonlyArray<string>;
  /** Optional parallel array (same length as `items`). When the user
   *  hits Tab, `fillText` resolves to `fillWith[i] ?? items[i]`. */
  fillWith?: ReadonlyArray<string>;
  /** Milliseconds between rotations. Default 3000. */
  intervalMs?: number;
  /** Pause flags. Either freezes rotation and snaps the per-word
   *  animation straight to "done" so the chip mounts immediately. */
  hasContent: boolean;
  isFocused: boolean;
}

export interface RotatingPlaceholder {
  /** Currently-displayed string, or null when inactive. */
  current: string | null;
  /** What gets dropped into the textarea on Tab. Same as `current`
   *  when `fillWith` isn't supplied. */
  fillText: string | null;
  /** Tokenized for animation; whitespace preserved as inert tokens. */
  tokens: PlaceholderToken[];
  /** Bumped on every rotation. Use as a React key so token spans
   *  re-mount and replay their CSS keyframe. */
  rotationKey: number;
  /** True once the staggered word-blur animation has finished. */
  streamDone: boolean;
}

const NOOP_RESULT: RotatingPlaceholder = {
  current: null,
  fillText: null,
  tokens: [],
  rotationKey: 0,
  streamDone: false,
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function tokenize(value: string): PlaceholderToken[] {
  let wordIdx = 0;
  return value
    .split(/(\s+)/)
    .filter((t) => t.length > 0)
    .map((text) => {
      const isWhitespace = /^\s+$/.test(text);
      return { text, wordIndex: isWhitespace ? -1 : wordIdx++ };
    });
}

/**
 * Drives the rotating-placeholder UX on the home composer.
 *
 * Rotation pauses while the textarea has content or is focused
 * (so the user isn't fighting motion they're trying to read). The
 * per-word stream is purely a JSX overlay: each word gets a
 * staggered `animation-delay` and the `streamDone` flag flips to
 * `true` once the last word has finished — used to gate things like
 * the "TAB" chip's fade-in.
 */
export function useRotatingPlaceholder({
  items,
  fillWith,
  intervalMs = 3000,
  hasContent,
  isFocused,
}: Options): RotatingPlaceholder {
  const active = items.length > 0;
  const [idx, setIdx] = useState(0);

  // Rotation interval — paused when typing or when the composer has focus.
  useEffect(() => {
    if (!active || hasContent || isFocused) return;
    if (prefersReducedMotion()) {
      setIdx(0);
      return;
    }
    const id = window.setInterval(() => setIdx((i) => i + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [active, hasContent, isFocused, intervalMs]);

  const current = active ? (items[idx % items.length] ?? null) : null;
  const fillText = active
    ? (fillWith?.[idx % items.length] ?? current)
    : null;

  const tokens = useMemo(() => (current ? tokenize(current) : []), [current]);
  const wordCount = useMemo(
    () => tokens.reduce((n, t) => n + (t.wordIndex >= 0 ? 1 : 0), 0),
    [tokens],
  );

  const [streamDone, setStreamDone] = useState(false);
  useEffect(() => {
    if (!current || wordCount === 0) {
      setStreamDone(false);
      return;
    }
    // Skip-to-end the moment focus lands or the user prefers reduced motion.
    if (isFocused || prefersReducedMotion()) {
      setStreamDone(true);
      return;
    }
    setStreamDone(false);
    const total = (wordCount - 1) * ROTATING_WORD_STAGGER_MS + ROTATING_WORD_ANIM_MS;
    const id = window.setTimeout(() => setStreamDone(true), total);
    return () => window.clearTimeout(id);
  }, [current, wordCount, isFocused]);

  if (!active) return NOOP_RESULT;
  return { current, fillText, tokens, rotationKey: idx, streamDone };
}
