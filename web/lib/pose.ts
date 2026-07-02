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
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

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
  userAngle: number;
  idealAngle: number;
  deviation: number;
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
      runningMode: "VIDEO",
      numPoses: 1,
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
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("Couldn't read that video file."));
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { v.removeEventListener("seeked", done); resolve(); };
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
}

const REFERENCE: Record<string, number> = {
  elbow: 158,   // dominant arm, fairly extended at contact
  knee: 150,    // loaded legs, some bend
  trunk: 165,   // upright-ish, not leaning back
};

export async function analyzeStroke(file: File, stroke: string): Promise<PoseAnalysis> {
  const landmarker = await getLandmarker();
  const video = await loadVideo(file);
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 2;

  const N = 24;
  const frames: { t: number; pts: Pt[] }[] = [];
  try {
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * duration * 0.98;
      await seek(video, t);
      const res = landmarker.detectForVideo(video, Math.round(t * 1000) + i);
      const lm = res.landmarks?.[0];
      if (lm && lm.length) frames.push({ t, pts: lm as Pt[] });
    }
  } finally {
    URL.revokeObjectURL(video.src);
  }

  if (frames.length < 6) {
    throw new Error("Couldn't track a body clearly. Use a clip where you're fully in frame and well lit.");
  }

  // Dominant side = whichever wrist travels more across the clip.
  const wristPath = (idx: number) =>
    frames.slice(1).reduce((s, f, i) => s + dist(f.pts[idx], frames[i].pts[idx]), 0);
  const rightDominant = wristPath(L.rWrist) >= wristPath(L.lWrist);
  const wristIdx = rightDominant ? L.rWrist : L.lWrist;
  const elbowIdx = rightDominant ? L.rElbow : L.lElbow;
  const shoulderIdx = rightDominant ? L.rShoulder : L.lShoulder;
  const hipIdx = rightDominant ? L.rHip : L.lHip;
  const kneeIdx = rightDominant ? L.rKnee : L.lKnee;
  const ankleIdx = rightDominant ? L.rAnkle : L.lAnkle;

  // Contact frame = peak wrist speed.
  let contact = 1, best = -1;
  for (let i = 1; i < frames.length; i++) {
    const sp = dist(frames[i].pts[wristIdx], frames[i - 1].pts[wristIdx]);
    if (sp > best) { best = sp; contact = i; }
  }
  const cf = frames[contact].pts;

  // Real joint angles at contact.
  const elbow = angle(cf[shoulderIdx], cf[elbowIdx], cf[wristIdx]);
  const knee = angle(cf[hipIdx], cf[kneeIdx], cf[ankleIdx]);
  const trunk = angle(cf[shoulderIdx], cf[hipIdx], cf[kneeIdx]);
  const otherKnee = angle(
    cf[rightDominant ? L.lHip : L.rHip],
    cf[rightDominant ? L.lKnee : L.rKnee],
    cf[rightDominant ? L.lAnkle : L.rAnkle],
  );

  const jf = (joint: string, val: number, ideal: number): JointFeedback => {
    const dev = Math.round(val - ideal);
    const ad = Math.abs(dev);
    const status = ad <= 8 ? "good" : ad <= 18 ? "minor" : "off";
    const note = status === "good" ? "In a good range." : status === "minor" ? "A little off — worth a look." : "Notably off at contact.";
    return { joint, userAngle: Math.round(val), idealAngle: ideal, deviation: dev, status, note };
  };
  const jointFeedback = [
    jf("contact arm", elbow, REFERENCE.elbow),
    jf("front knee", knee, REFERENCE.knee),
    jf("trunk", trunk, REFERENCE.trunk),
  ];

  // Derive flaws from what we measured (ids match the drill catalogue).
  const flaws: StrokeFlaw[] = [];
  if (elbow < REFERENCE.elbow - 18) {
    flaws.push({ id: "low_elbow", label: "Elbow bent at contact", coaching_cue: "Extend through the ball and keep the elbow up.", severity: clamp((REFERENCE.elbow - elbow) / 60) });
  }
  const avgKnee = (knee + otherKnee) / 2;
  if (avgKnee > 168) {
    flaws.push({ id: "narrow_base", label: "Legs too straight", coaching_cue: "Bend the knees and load into the shot.", severity: clamp((avgKnee - 160) / 25) });
  }
  if (Math.abs(trunk - REFERENCE.trunk) > 20) {
    flaws.push({ id: "open_stance_drift", label: "Weight leaning back", coaching_cue: "Drive off the front foot and stay forward.", severity: clamp(Math.abs(trunk - REFERENCE.trunk) / 45) });
  }
  // Follow-through: how far the wrist keeps travelling after contact.
  const post = frames.slice(contact + 1).reduce((s, f, i) => s + dist(f.pts[wristIdx], frames[contact + i].pts[wristIdx]), 0);
  const pre = frames.slice(1, contact + 1).reduce((s, f, i) => s + dist(f.pts[wristIdx], frames[i].pts[wristIdx]), 0);
  if (contact < frames.length - 2 && pre > 0 && post < pre * 0.4) {
    flaws.push({ id: "short_followthrough", label: "Short follow-through", coaching_cue: "Finish the swing high, over the shoulder.", severity: clamp(1 - post / (pre + 1e-6)) });
  }

  const totalDev = jointFeedback.reduce((s, j) => s + Math.abs(j.deviation), 0);
  const formScore = Math.max(0, Math.round(100 - totalDev * 0.8 - flaws.length * 4));

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
  };
}

const clamp = (x: number) => Math.max(0.2, Math.min(1, x));
const round2 = (x: number) => Math.round(x * 100) / 100;
