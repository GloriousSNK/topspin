// Real, in-browser stroke analysis using MediaPipe Pose.
//
// This replaces the old fabricated "V-JEPA" stub. It runs a pose model on the
// actual uploaded clip, finds the contact frame (peak wrist speed), measures
// real joint angles, and derives feedback + flaws from what it sees.
//
// Everything runs client-side — no GPU server, no upload required for the
// analysis itself.

import type { PoseLandmarker as PoseLandmarkerT } from "@mediapipe/tasks-vision";

const MP_VERSION = "0.10.14";
// "full" model: markedly better at actually finding the body than "lite".
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

// BlazePose landmark indices we care about.
const L = {
  nose: 0,
  lShoulder: 11, rShoulder: 12,
  lElbow: 13, rElbow: 14,
  lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24,
  lKnee: 25, rKnee: 26,
  lAnkle: 27, rAnkle: 28,
};

export interface JointFeedback {
  joint: string;
  reading: string;
  status: "good" | "minor" | "off";
  note: string;
}
export interface StrokeFlaw {
  id: string;
  label: string;
  severity: number;
  coaching_cue: string;
}
export interface PoseAnalysis {
  stroke: string;
  formScore: number;
  jointFeedback: JointFeedback[];
  flaws: StrokeFlaw[];
  skeleton: Record<string, [number, number]>;
  framesAnalyzed: number;
  seconds: number;
}

type Pt = { x: number; y: number; z: number; visibility?: number };

let _landmarker: PoseLandmarkerT | null = null;

async function getLandmarker(): Promise<PoseLandmarkerT> {
  if (_landmarker) return _landmarker;
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
  );
  const make = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      // IMAGE mode treats each seeked frame independently — far more reliable
      // than VIDEO mode when we're jumping around the clip.
      runningMode: "IMAGE",
      numPoses: 1,
      // Low thresholds so partial / dim / off-angle clips still register.
      minPoseDetectionConfidence: 0.2,
      minPosePresenceConfidence: 0.2,
      minTrackingConfidence: 0.2,
    });
  try {
    _landmarker = await make("GPU");
  } catch {
    _landmarker = await make("CPU"); // fall back if WebGL delegate is unavailable
  }
  return _landmarker;
}

function angle(a: Pt, b: Pt, c: Pt): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!mag) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    (v as HTMLVideoElement & { playsInline: boolean }).playsInline = true;
    v.src = URL.createObjectURL(file);
    const ready = () => resolve(v);
    v.onloadeddata = ready;
    v.oncanplay = ready;              // some formats fire this first
    v.onerror = () => reject(new Error("Couldn't read that video file. Try mp4 or mov."));
    setTimeout(() => (v.readyState >= 2 ? resolve(v) : reject(new Error("Video took too long to load."))), 15000);
  });
}

// Seek and wait for the frame, with a timeout so a stubborn decode can't hang.
function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; v.removeEventListener("seeked", finish); resolve(); };
    v.addEventListener("seeked", finish);
    try { v.currentTime = Math.max(0, t); } catch { finish(); }
    setTimeout(finish, 1200);
  });
}

// Some (esp. webm) clips report Infinity duration until you seek to the end.
async function resolveDuration(v: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
  await seek(v, 1e6);
  await seek(v, 0);
  return Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 3;
}

// Wait until the just-seeked frame is actually painted, so detection sees pixels.
function nextPainted(v: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const anyV = v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
    if (anyV.requestVideoFrameCallback) {
      anyV.requestVideoFrameCallback(() => resolve());
      setTimeout(resolve, 300);
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }
  });
}

export async function analyzeStroke(file: File, stroke: string): Promise<PoseAnalysis> {
  let landmarker: PoseLandmarkerT;
  try {
    landmarker = await getLandmarker();
  } catch {
    throw new Error("Couldn't load the analysis model. Check your connection and try again.");
  }

  const video = await loadVideo(file);
  const duration = await resolveDuration(video);

  // Draw each frame onto a canvas and detect on that. Downscale big clips so a
  // huge frame doesn't slow (or choke) detection.
  const scale = Math.min(1, 640 / Math.max(video.videoWidth || 640, video.videoHeight || 640));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round((video.videoWidth || 640) * scale));
  canvas.height = Math.max(2, Math.round((video.videoHeight || 480) * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const detectCanvas = (): Pt[] | null => {
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const lm = landmarker.detect(canvas).landmarks?.[0];
      return lm && lm.length >= 25 ? (lm as Pt[]) : null;
    } catch {
      return null;
    }
  };

  type RVFC = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  };

  // Primary capture: play the clip and read each painted frame in order. This
  // is the most reliable way to get real, decoded pixels — no seek guesswork.
  const playCapture = (): Promise<{ t: number; pts: Pt[] }[] | null> =>
    new Promise((resolve) => {
      const v = video as RVFC;
      if (!v.requestVideoFrameCallback) return resolve(null);
      const out: { t: number; pts: Pt[] }[] = [];
      let done = false;
      const stop = () => { if (done) return; done = true; try { video.pause(); } catch {} resolve(out); };
      const onFrame = (_now: number, meta: { mediaTime: number }) => {
        if (done) return;
        const pts = detectCanvas();
        if (pts) out.push({ t: meta.mediaTime, pts });
        if (out.length >= 45 || meta.mediaTime >= 6) return stop();
        v.requestVideoFrameCallback!(onFrame);
      };
      v.requestVideoFrameCallback!(onFrame);
      video.play().catch(() => stop());
      video.onended = stop;
      setTimeout(stop, 9000);
    });

  // Fallback capture: seek to evenly spaced times.
  const seekCapture = async (): Promise<{ t: number; pts: Pt[] }[]> => {
    const out: { t: number; pts: Pt[] }[] = [];
    const N = 26;
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * duration * 0.98;
      await seek(video, t);
      await nextPainted(video);
      if (!video.videoWidth) continue;
      const pts = detectCanvas();
      if (pts) out.push({ t, pts });
    }
    return out;
  };

  // Warm up GPU shaders (the first detect is often empty).
  try { await seek(video, 0); await nextPainted(video); detectCanvas(); } catch { /* best effort */ }

  let frames = (await playCapture()) ?? [];
  if (frames.length < 6) {
    try { video.pause(); } catch {}
    const seeked = await seekCapture();
    if (seeked.length > frames.length) frames = seeked;
  }
  URL.revokeObjectURL(video.src);

  if (frames.length < 3) {
    throw new Error("Couldn't find a person in that clip. Make sure your body is visible through the swing.");
  }

  frames = smoothFrames(frames); // steady the keypoints before measuring angles

  // Dominant arm = the wrist that travels most.
  const travel = (idx: number) =>
    frames.slice(1).reduce((s, f, i) => s + dist(f.pts[idx], frames[i].pts[idx]), 0);
  const right = travel(L.rWrist) >= travel(L.lWrist);
  const Wr = right ? L.rWrist : L.lWrist;
  const El = right ? L.rElbow : L.lElbow;
  const Sh = right ? L.rShoulder : L.lShoulder;
  const Hp = right ? L.rHip : L.lHip;
  const Kn = right ? L.rKnee : L.lKnee;
  const An = right ? L.rAnkle : L.lAnkle;

  // Contact = peak wrist speed frame.
  let contact = Math.min(1, frames.length - 1), best = -1;
  for (let i = 1; i < frames.length; i++) {
    const sp = dist(frames[i].pts[Wr], frames[i - 1].pts[Wr]);
    if (sp > best) { best = sp; contact = i; }
  }
  const cf = frames[contact].pts;
  const vis = (p: Pt) => (p.visibility ?? 1) >= 0.4;
  const P = frames.map((f) => f.pts);

  // Body scale (torso length) so all distances are independent of how big the
  // person appears in frame.
  const torsoLen = Math.max(
    0.04,
    median(P.map((p) => (dist(p[L.lShoulder], p[L.lHip]) + dist(p[L.rShoulder], p[L.rHip])) / 2)),
  );

  // Measurements, normalised by torso length.
  let back = 0, follow = 0;
  for (let i = 1; i < P.length; i++) {
    const d = dist(P[i][Wr], P[i - 1][Wr]) / torsoLen;
    if (i <= contact) back += d; else follow += d;
  }
  const amp = back + follow;                                        // total swing size
  const shoulderY = (cf[L.lShoulder].y + cf[L.rShoulder].y) / 2;
  const contactHigh = (shoulderY - cf[Wr].y) / torsoLen;           // +ve = wrist above shoulders
  const rise = (P[0][Wr].y - P[P.length - 1][Wr].y) / torsoLen;    // +ve = low-to-high path
  const elbow = vis(cf[Sh]) && vis(cf[El]) && vis(cf[Wr]) ? angle(cf[Sh], cf[El], cf[Wr]) : null;
  const kfr = frames.filter((f) => vis(f.pts[Hp]) && vis(f.pts[Kn]) && vis(f.pts[An]));
  const kneeFlex = kfr.length >= 3 ? 180 - Math.min(...kfr.map((f) => angle(f.pts[Hp], f.pts[Kn], f.pts[An]))) : null;

  // Each check grades one measurement against what THIS stroke should look like.
  type Chk = { label: string; reading: string; q: number; ok: string; bad: string; flaw?: { id: string; label: string; cue: string } };
  const checks: Chk[] = [];
  const band = (v: number, lo: number, hi: number, tol: number) =>
    v >= lo && v <= hi ? 1 : Math.max(0, 1 - (v < lo ? lo - v : v - hi) / tol);
  const on = (cond: boolean, c: Chk) => { if (cond) checks.push(c); };
  const kind = stroke === "volley" ? "volley" : stroke === "serve" ? "serve" : stroke === "slice" ? "slice" : "ground";

  if (kind === "volley") {
    on(true, { label: "Compactness", reading: amp.toFixed(1), q: band(amp, 0.2, 2.0, 2.2), ok: "Short and compact.", bad: "Too much swing — punch it, racquet in front.", flaw: { id: "early_contact", label: "Swing too long for a volley", cue: "Punch, don't swing. Keep it short and out front." } });
    on(true, { label: "Contact height", reading: contactHigh.toFixed(2), q: band(contactHigh, -0.2, 1.0, 0.8), ok: "Met out in front.", bad: "Take it in front, around shoulder height.", flaw: { id: "early_contact", label: "Contact position off", cue: "Meet the ball in front of you." } });
    on(elbow != null, { label: "Firm arm", reading: `${Math.round(elbow ?? 0)}°`, q: band(elbow ?? 130, 95, 168, 45), ok: "Firm through the block.", bad: "Arm too loose — stay firm.", flaw: { id: "wrist_instability", label: "Loose arm at contact", cue: "Firm the wrist and block through the ball." } });
    on(kneeFlex != null, { label: "Stay low", reading: `${Math.round(Math.max(0, kneeFlex ?? 0))}° flex`, q: band(kneeFlex ?? 20, 6, 45, 18), ok: "Low and ready.", bad: "Bend more, stay low.", flaw: { id: "narrow_base", label: "Standing too tall", cue: "Split-step and stay low on the volley." } });
  } else if (kind === "serve") {
    on(true, { label: "Reach at contact", reading: contactHigh.toFixed(2), q: band(contactHigh, 0.5, 2.5, 0.8), ok: "Contacting up high.", bad: "Reach up — hit at full stretch.", flaw: { id: "low_elbow", label: "Contact too low", cue: "Hit the ball at full extension overhead." } });
    on(elbow != null, { label: "Extension", reading: `${Math.round(elbow ?? 0)}°`, q: band(elbow ?? 150, 150, 182, 45), ok: "Fully extended.", bad: "Straighten the arm fully.", flaw: { id: "low_elbow", label: "Arm not extended", cue: "Reach up and straighten the arm at contact." } });
    on(kneeFlex != null, { label: "Leg drive", reading: `${Math.round(Math.max(0, kneeFlex ?? 0))}° flex`, q: band(kneeFlex ?? 25, 15, 75, 22), ok: "Good leg load.", bad: "Load and drive with the legs.", flaw: { id: "narrow_base", label: "Little leg drive", cue: "Bend the knees and drive up into the ball." } });
    on(true, { label: "Motion size", reading: amp.toFixed(1), q: band(amp, 2.0, 12, 3), ok: "Full motion.", bad: "Let the full service motion unfold.", flaw: { id: "late_preparation", label: "Rushed motion", cue: "Take your time through the whole motion." } });
  } else if (kind === "slice") {
    on(true, { label: "High to low", reading: rise.toFixed(2), q: band(rise, -3, 0.35, 1.1), ok: "Cutting down through the ball.", bad: "Slice cuts high to low — start above the ball.", flaw: { id: "short_followthrough", label: "Path goes upward", cue: "Start the racquet high and cut down and through for underspin." } });
    on(true, { label: "Controlled swing", reading: amp.toFixed(1), q: band(amp, 1.4, 6, 2.6), ok: "Compact and controlled.", bad: "Keep the slice compact and controlled.", flaw: { id: "early_contact", label: "Swing too loose", cue: "Keep it compact — guide the racquet, don't swing big." } });
    on(elbow != null, { label: "Firm arm", reading: `${Math.round(elbow ?? 0)}°`, q: band(elbow ?? 150, 120, 182, 45), ok: "Firm and extended.", bad: "Keep the arm firm and out in front.", flaw: { id: "wrist_instability", label: "Wrist too loose", cue: "Firm the wrist and lead with the edge." } });
    on(kneeFlex != null, { label: "Stay low", reading: `${Math.round(Math.max(0, kneeFlex ?? 0))}° flex`, q: band(kneeFlex ?? 18, 6, 50, 18), ok: "Bent and balanced.", bad: "Bend the knees and stay down through it.", flaw: { id: "narrow_base", label: "Standing too tall", cue: "Bend the knees and stay low through the slice." } });
  } else {
    on(true, { label: "Swing length", reading: amp.toFixed(1), q: band(amp, 2.2, 10, 3), ok: "Full swing.", bad: "Take a bigger, earlier backswing.", flaw: { id: "late_preparation", label: "Swing too short", cue: "Prepare earlier and take a fuller swing." } });
    on(true, { label: "Follow-through", reading: follow.toFixed(1), q: band(follow, 1.2, 8, 1.6), ok: "Finishes long.", bad: "Carry the finish higher and longer.", flaw: { id: "short_followthrough", label: "Short follow-through", cue: "Finish high, over the shoulder." } });
    on(true, { label: "Low to high", reading: rise.toFixed(2), q: band(rise, 0.1, 3, 1.1), ok: "Good upward path.", bad: "Swing low to high, brush up the ball.", flaw: { id: "short_followthrough", label: "Flat swing path", cue: "Start low and finish high for topspin." } });
    on(kneeFlex != null, { label: "Knee load", reading: `${Math.round(Math.max(0, kneeFlex ?? 0))}° flex`, q: band(kneeFlex ?? 18, 8, 55, 18), ok: "Loaded well.", bad: "Bend the knees to load.", flaw: { id: "narrow_base", label: "Legs too straight", cue: "Bend the knees and load into the shot." } });
    on(elbow != null, { label: "Contact arm", reading: `${Math.round(elbow ?? 0)}°`, q: band(elbow ?? 140, 115, 178, 45), ok: "Extended at contact.", bad: "Extend more through contact.", flaw: { id: "low_elbow", label: "Arm cramped at contact", cue: "Extend the arm through the ball." } });
  }

  const jointFeedback: JointFeedback[] = checks.map((c) => ({
    joint: c.label,
    reading: c.reading,
    status: c.q >= 0.75 ? "good" : c.q >= 0.5 ? "minor" : "off",
    note: c.q >= 0.75 ? c.ok : c.bad,
  }));
  const flaws: StrokeFlaw[] = checks
    .filter((c) => c.q < 0.5 && c.flaw)
    .map((c) => ({ id: c.flaw!.id, label: c.flaw!.label, coaching_cue: c.flaw!.cue, severity: round2(0.35 + (1 - c.q) * 0.55) }));

  // Score = how well the swing matches this stroke, averaged over what we saw.
  const formScore = checks.length
    ? Math.round((checks.reduce((s, c) => s + c.q, 0) / checks.length) * 100)
    : 70;

  // Contact-frame skeleton (normalized) for drawing.
  const nm = (i: number): [number, number] => [cf[i].x, cf[i].y];
  const skeleton: Record<string, [number, number]> = {
    nose: nm(L.nose),
    left_shoulder: nm(L.lShoulder), right_shoulder: nm(L.rShoulder),
    left_elbow: nm(L.lElbow), right_elbow: nm(L.rElbow),
    left_wrist: nm(L.lWrist), right_wrist: nm(L.rWrist),
    left_hip: nm(L.lHip), right_hip: nm(L.rHip),
    left_knee: nm(L.lKnee), right_knee: nm(L.rKnee),
    left_ankle: nm(L.lAnkle), right_ankle: nm(L.rAnkle),
  };

  return {
    stroke: stroke === "auto" ? "stroke" : stroke,
    formScore,
    jointFeedback,
    flaws: flaws.sort((a, b) => b.severity - a.severity).map((f) => ({ ...f, severity: round2(f.severity) })),
    skeleton,
    framesAnalyzed: frames.length,
    seconds: Math.round(duration),
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// 3-frame moving average of each landmark to damp per-frame jitter, which
// otherwise throws off the joint angles.
function smoothFrames(frames: { t: number; pts: Pt[] }[]): { t: number; pts: Pt[] }[] {
  if (frames.length < 3) return frames;
  const out = frames.map((f) => ({ t: f.t, pts: f.pts.map((p) => ({ ...p })) }));
  for (let i = 1; i < frames.length - 1; i++) {
    for (let k = 0; k < frames[i].pts.length; k++) {
      const a = frames[i - 1].pts[k], b = frames[i].pts[k], c = frames[i + 1].pts[k];
      out[i].pts[k].x = (a.x + b.x + c.x) / 3;
      out[i].pts[k].y = (a.y + b.y + c.y) / 3;
    }
  }
  return out;
}
