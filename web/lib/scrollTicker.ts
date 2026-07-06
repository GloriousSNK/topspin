"use client";

/*
 * One scroll listener, one rAF, for the whole page.
 *
 * Every scroll-driven visual used to wire up its own `scroll` handler and its
 * own requestAnimationFrame. On a long page that meant three or four listeners
 * all reading layout on the same frame, which is exactly how you get jank.
 * Now they subscribe here: we listen once, coalesce into a single rAF, and
 * fan out to every subscriber in that one frame.
 */

type Sub = () => void;

const subs = new Set<Sub>();
let scheduled = false;

function flush() {
  scheduled = false;
  for (const fn of subs) fn();
}

function request() {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(flush);
  }
}

export function onScrollFrame(fn: Sub): () => void {
  if (subs.size === 0 && typeof window !== "undefined") {
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
  }
  subs.add(fn);
  fn(); // run once so the initial state is correct
  return () => {
    subs.delete(fn);
    if (subs.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    }
  };
}
