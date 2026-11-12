"use client";

/*
 * One scroll listener, one rAF, for the whole page.
 *
 * Every scroll-driven visual used to wire up its own `scroll` handler and its
 * own requestAnimationFrame. On a long page that meant three or four listeners
 * all reading layout on the same frame, which is exactly how you get jank.
 * Now they subscribe here: we listen once, coalesce into a single rAF, and
 * fan out to every subscriber in that one frame.
 *
 * Read/write split: a subscriber does its layout reads (getBoundingClientRect,
 * innerHeight) when called, and may return a function that does its DOM
 * writes. Every subscriber's reads run first, then every write, so one
 * visual's writes never force a synchronous re-layout for the next one's
 * reads. Subscribers that return nothing keep working as before.
 */

type Write = () => void;
type Sub = () => void | Write;

const subs = new Set<Sub>();
let scheduled = false;
const writes: Write[] = [];

function flush() {
  scheduled = false;
  for (const fn of subs) {
    const w = fn();
    if (w) writes.push(w);
  }
  for (let i = 0; i < writes.length; i++) writes[i]();
  writes.length = 0;
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
    window.addEventListener("resize", request, { passive: true });
  }
  subs.add(fn);
  fn()?.(); // run once so the initial state is correct
  return () => {
    subs.delete(fn);
    if (subs.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    }
  };
}
