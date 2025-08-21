import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export function createIdleTimer(timeoutMs: number) {
  const idle = writable(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const reset = () => {
    if (!browser) return;
    idle.set(false);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => idle.set(true), timeoutMs);
  };

  const start = () => {
    if (!browser) return;
    ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((e) =>
      window.addEventListener(e, reset, { passive: true })
    );
    reset();
  };

  const stop = () => {
    if (!browser) return;
    ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((e) =>
      window.removeEventListener(e, reset)
    );
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return { idle, start, stop, reset };
}
