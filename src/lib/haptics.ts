/**
 * Haptic feedback for mobile PWA interactions.
 *
 * Powered by `web-haptics`, which combines navigator.vibrate (Android)
 * with the AudioContext + <input type="checkbox" switch> trick that
 * triggers haptics on iOS Safari. The instance is created lazily on the
 * first client-side call so SSR and the initial render stay clean.
 */

import { WebHaptics, type HapticInput } from "web-haptics";

let instance: WebHaptics | null = null;

function getInstance(): WebHaptics | null {
  if (typeof window === "undefined") return null;
  if (!instance) {
    instance = new WebHaptics();
  }
  return instance;
}

function trigger(input: HapticInput) {
  const inst = getInstance();
  if (!inst) return;
  // Fire and forget — callers don't await the vibration.
  inst.trigger(input).catch(() => {
    /* swallow errors — haptics are best-effort */
  });
}

/** Light tap — standard buttons, menu opens, navigation */
export function tap() {
  trigger("light");
}

/** Very subtle — form focus, micro-interactions */
export function subtle() {
  trigger("selection");
}

/** Selection-style pulse — visibility, theme, mode switches */
export function toggle() {
  trigger("selection");
}

/** Stronger pulse — destructive intent (first tap on delete) */
export function medium() {
  trigger("medium");
}

/** Two-step ascending pattern — successful submit, import, refresh complete */
export function success() {
  trigger("success");
}

/** Strong triple-pulse — confirmed destructive action */
export function destructive() {
  trigger("error");
}

/** Heavy then soft — pull-to-refresh threshold crossed */
export function threshold() {
  trigger("nudge");
}
