"use client";

// The analysed clip with the MediaPipe skeleton drawn on top. Two views:
//  - Contact frame: the video paused on the detected contact frame, with the
//    landmarks the analysis measured.
//  - Full clip: the whole video playing (optionally slowed down), with the pose
//    detected live on every frame as it plays.
// The clip is the visitor's local file (an object URL). Nothing is uploaded.

import { useCallback, useEffect, useRef, useState } from "react";
import { createFrameDetector, POSE_BONES, type PosePoint } from "@/lib/pose";

type Mode = "contact" | "clip";
type RVFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

const RATES = [0.25, 0.5, 1] as const;
const MIN_VIS = 0.35;   // drawn solid
const MIN_GUESS = 0.08; // drawn faded and dashed
// Arm landmarks per side (shoulder, elbow, wrist, hand points) for highlighting.
const ARM = { left: new Set([11, 13, 15, 17, 19, 21]), right: new Set([12, 14, 16, 18, 20, 22]) };

export default function PoseVideo({ src, contactTime, contactPose, hittingSide, label = "Your swing" }: {
  src: string;
  contactTime: number;
  contactPose: PosePoint[];
  hittingSide: "left" | "right";
  label?: string;
}) {
  const videoRef = useRef<RVFCVideo>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const detectRef = useRef<((v: HTMLVideoElement) => PosePoint[] | null) | null>(null);
  const poseRef = useRef<PosePoint[] | null>(null);
  const lastTRef = useRef(-1);
  const showRef = useRef(true);
  const modeRef = useRef<Mode>("contact");

  const [mode, setMode] = useState<Mode>("contact");
  const [aspect, setAspect] = useState(16 / 9);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<(typeof RATES)[number]>(0.5);
  const [show, setShow] = useState(true);
  const [noPose, setNoPose] = useState(false);

  // ---- drawing --------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pose = poseRef.current;
    if (!showRef.current || !pose) return;
    const W = canvas.width, H = canvas.height;
    const unit = Math.max(1.5, Math.min(W, H) / 220); // line weight scales with the picture
    const arm = ARM[hittingSide];
    const vis = (i: number) => pose[i]?.v ?? 0;
    const seen = (i: number) => vis(i) >= MIN_VIS;
    // Points the model is unsure of (often a wrist hidden behind the body) are
    // still drawn, faded and dashed, so you can see its best guess.
    const guessed = (i: number) => !seen(i) && vis(i) >= MIN_GUESS;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const pass of [0, 1]) {
      for (const [a, b] of POSE_BONES) {
        const sure = seen(a) && seen(b);
        if (!sure && !((seen(a) || guessed(a)) && (seen(b) || guessed(b)))) continue;
        const hit = arm.has(a) && arm.has(b);
        ctx.globalAlpha = sure ? 1 : 0.6;
        ctx.setLineDash(sure ? [] : [unit * 2.6, unit * 2.2]);
        ctx.strokeStyle = pass === 0 ? "rgba(10, 14, 10, 0.55)" : hit ? "#d3e94c" : "rgba(255, 255, 250, 0.92)";
        ctx.lineWidth = pass === 0 ? unit * 3.4 : unit * (hit ? 2.2 : 1.7);
        ctx.beginPath();
        ctx.moveTo(pose[a].x * W, pose[a].y * H);
        ctx.lineTo(pose[b].x * W, pose[b].y * H);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    for (let i = 11; i < pose.length; i++) {
      if (!seen(i) && !guessed(i)) continue;
      const r = unit * (arm.has(i) ? 2.4 : 1.9);
      ctx.globalAlpha = seen(i) ? 1 : 0.6;
      ctx.beginPath();
      ctx.arc(pose[i].x * W, pose[i].y * H, r, 0, Math.PI * 2);
      ctx.fillStyle = arm.has(i) ? "#d3e94c" : "#ffffff";
      ctx.fill();
      ctx.lineWidth = unit * 0.9;
      ctx.strokeStyle = "rgba(10, 14, 10, 0.8)";
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (seen(0)) { // a head marker is enough; face points just add clutter
      ctx.beginPath();
      ctx.arc(pose[0].x * W, pose[0].y * H, unit * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 250, 0.92)";
      ctx.fill();
    }
  }, [hittingSide]);

  // Keep the canvas backing store matched to its on-screen size.
  useEffect(() => {
    const stage = stageRef.current, canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ro = new ResizeObserver(([en]) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, Math.round(en.contentRect.width * dpr));
      canvas.height = Math.max(2, Math.round(en.contentRect.height * dpr));
      draw();
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [draw]);

  // ---- live detection -------------------------------------------------------
  const detectNow = useCallback(() => {
    const video = videoRef.current, detect = detectRef.current;
    if (!video || !detect || modeRef.current !== "clip") return;
    const t = video.currentTime;
    const next = detect(video);
    const prev = poseRef.current;
    // Light smoothing between neighbouring frames while playing forward; a jump
    // (seek, loop) takes the new pose as is.
    if (next && prev && t > lastTRef.current && t - lastTRef.current < 0.12) {
      for (let i = 0; i < next.length; i++) {
        next[i].x = prev[i].x * 0.35 + next[i].x * 0.65;
        next[i].y = prev[i].y * 0.35 + next[i].y * 0.65;
      }
    }
    lastTRef.current = t;
    poseRef.current = next;
    setNoPose(!next);
    draw();
  }, [draw]);

  useEffect(() => {
    let alive = true;
    createFrameDetector().then((fn) => { if (alive) detectRef.current = fn; }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // While the full clip plays, detect on every frame the browser paints.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mode !== "clip" || !playing) return;
    let id = 0, raf = 0, stopped = false;
    if (video.requestVideoFrameCallback) {
      const onFrame = () => { if (stopped) return; detectNow(); id = video.requestVideoFrameCallback!(onFrame); };
      id = video.requestVideoFrameCallback(onFrame);
    } else {
      let last = -1;
      const tick = () => {
        if (stopped) return;
        if (video.currentTime !== last) { last = video.currentTime; detectNow(); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      stopped = true;
      if (id) video.cancelVideoFrameCallback?.(id);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mode, playing, detectNow]);

  // ---- modes ----------------------------------------------------------------
  const showContact = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    poseRef.current = contactPose;
    setNoPose(false);
    // A hair past the frame's start time so the browser lands on that exact frame.
    video.currentTime = Math.min(Math.max(0, contactTime + 0.001), Math.max(0, (video.duration || contactTime) - 0.001));
    draw();
  }, [contactPose, contactTime, draw]);

  function switchMode(next: Mode) {
    modeRef.current = next;
    setMode(next);
    const video = videoRef.current;
    if (!video) return;
    if (next === "contact") { setPlaying(false); showContact(); return; }
    poseRef.current = null;
    lastTRef.current = -1;
    draw();
    video.playbackRate = rate;
    video.currentTime = 0;
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.playbackRate = rate; void video.play().then(() => setPlaying(true)).catch(() => {}); }
    else { video.pause(); setPlaying(false); }
  }

  function goToContact() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setPlaying(false);
    video.currentTime = Math.max(0, contactTime + 0.001);
  }

  function step(frames: number) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setPlaying(false);
    video.currentTime = Math.min(Math.max(0, video.currentTime + frames / 30), video.duration || 0);
  }

  function changeRate(next: (typeof RATES)[number]) {
    setRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }

  function toggleSkeleton() {
    showRef.current = !showRef.current;
    setShow(showRef.current);
    draw();
  }

  // ---- video events ---------------------------------------------------------
  function onLoaded() {
    const video = videoRef.current;
    if (!video) return;
    if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    if (modeRef.current === "contact") showContact();
  }

  function onSeeked() {
    // Paused on a new frame in the full-clip view: detect it once.
    if (modeRef.current === "clip" && videoRef.current?.paused) detectNow();
    setTime(videoRef.current?.currentTime ?? 0);
  }

  // A new clip resets to the contact view.
  useEffect(() => {
    modeRef.current = "contact";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset tied to a new source
    setMode("contact"); setPlaying(false); setTime(0);
  }, [src]);

  const pct = (t: number) => (duration ? `${Math.min(100, Math.max(0, (t / duration) * 100))}%` : "0%");

  return (
    <div className="pose-video">
      <div className="pose-video-head">
        <div className="seg" role="tablist" aria-label={`${label} view`}>
          <button type="button" role="tab" aria-selected={mode === "contact"} className={mode === "contact" ? "on" : ""}
            onClick={() => switchMode("contact")}>Contact frame</button>
          <button type="button" role="tab" aria-selected={mode === "clip"} className={mode === "clip" ? "on" : ""}
            onClick={() => switchMode("clip")}>Full clip</button>
        </div>
        <label className="pose-toggle">
          <input type="checkbox" checked={show} onChange={toggleSkeleton} /> Skeleton
        </label>
      </div>

      <div className="pose-stage-wrap">
        <div ref={stageRef} className="pose-stage" style={{ aspectRatio: String(aspect), width: `min(100%, calc(70vh * ${aspect}))` }}>
          <video ref={videoRef} src={src} muted playsInline loop={mode === "clip"} preload="auto"
            aria-label={label} onLoadedMetadata={onLoaded} onLoadedData={onLoaded} onSeeked={onSeeked}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
          <canvas ref={canvasRef} aria-hidden="true" />
          {mode === "contact" && <span className="pose-badge">Contact · {contactTime.toFixed(2)} s</span>}
          {mode === "clip" && show && noPose && <span className="pose-badge muted">No body found on this frame</span>}
        </div>
      </div>

      {mode === "contact" ? (
        <div className="pose-controls">
          <span className="pose-hint">The frame the analysis measured, with the skeleton it found.</span>
          <button type="button" className="btn btn-ghost" onClick={() => switchMode("clip")}>Play full clip with skeleton ▸</button>
        </div>
      ) : (
        <div className="pose-controls">
          <button type="button" className="btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} style={{ minWidth: 84 }}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Back one frame" title="Back one frame">‹</button>
          <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Forward one frame" title="Forward one frame">›</button>
          <div className="pose-scrub">
            <input type="range" className="range" min={0} max={duration || 0} step={0.01} value={Math.min(time, duration || 0)}
              aria-label="Position in clip"
              onChange={(e) => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = Number(e.target.value); } }} />
            {duration > 0 && <span className="pose-contact-tick" style={{ left: pct(contactTime) }} title="Contact" />}
          </div>
          <span className="pose-time mono">{time.toFixed(2)} / {duration.toFixed(2)} s</span>
          <div className="seg small" role="group" aria-label="Playback speed">
            {RATES.map((r) => (
              <button key={r} type="button" className={rate === r ? "on" : ""} aria-pressed={rate === r} onClick={() => changeRate(r)}>
                {r === 1 ? "1×" : `${r}×`}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={goToContact}>Go to contact</button>
        </div>
      )}
    </div>
  );
}
