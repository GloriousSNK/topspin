// The contact-frame stick figure shown after an analysis (and in student folders).
export default function ContactSkeleton({ skeleton, caption = "your contact frame" }: {
  skeleton: Record<string, [number, number]>;
  caption?: string;
}) {
  const W = 280, H = 260;
  const p = (name: string) => skeleton[name] ? [skeleton[name][0] * W, skeleton[name][1] * H] : null;
  const bones: [string, string][] = [
    ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"],
    ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"], ["left_hip", "right_hip"],
    ["left_hip", "left_knee"], ["left_knee", "left_ankle"], ["right_hip", "right_knee"], ["right_knee", "right_ankle"],
    ["nose", "left_shoulder"], ["nose", "right_shoulder"],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption} style={{ width: "100%", maxWidth: 280, height: "auto", margin: "0 auto", display: "block",
      background: "var(--paper-2)", border: "1px solid rgba(29,34,27,0.35)", borderRadius: 12 }}>
      {bones.map(([a, b], i) => {
        const pa = p(a), pb = p(b);
        if (!pa || !pb) return null;
        return <line key={i} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />;
      })}
      {Object.keys(skeleton).map((name) => {
        const pt = p(name);
        if (!pt) return null;
        return <circle key={name} cx={pt[0]} cy={pt[1]} r={4} fill="var(--accent)" stroke="var(--ink)" strokeWidth={1.5} />;
      })}
      <text x={W / 2} y={H - 8} fill="var(--ink-soft)" fontSize={10} fontWeight={600} textAnchor="middle">{caption}</text>
    </svg>
  );
}
