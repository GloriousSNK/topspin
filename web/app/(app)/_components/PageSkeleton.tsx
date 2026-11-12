// Loading state for the app pages. Renders the real page header (eyebrow, title,
// lead) plus fixed-height placeholder cards roughly where the content will be,
// so nothing jumps when the data arrives — instead of a bare <h1> that the whole
// page then pops in under. Uses the existing .card class; `.skeleton` is an
// optional shimmer hook for globals.css (renders as a plain empty card without it).

export default function PageSkeleton({
  eyebrow, title, lead, blocks = [120, 220], stats = 0, backLink,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  /** Min-heights (px) of placeholder cards, top to bottom. */
  blocks?: number[];
  /** Number of small stat tiles to show in a .grid-4 row above the blocks. */
  stats?: number;
  /** Optional back link rendered above the title (keeps folder/player pages aligned). */
  backLink?: React.ReactNode;
}) {
  return (
    <div aria-busy="true">
      {backLink}
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 className="h1" style={backLink ? { marginTop: 12 } : undefined}>{title}</h1>
      {lead ? <p className="lead">{lead}</p> : <p className="lead" aria-hidden="true" style={{ minHeight: "3.2em" }} />}
      <span role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        Loading…
      </span>
      {stats > 0 && (
        <div className="grid grid-4" style={{ marginBottom: 18 }} aria-hidden="true">
          {Array.from({ length: stats }, (_, i) => <div key={i} className="card skeleton" style={{ padding: 16, minHeight: 82 }} />)}
        </div>
      )}
      {blocks.map((h, i) => (
        <div key={i} className="card skeleton" aria-hidden="true" style={{ minHeight: h, marginBottom: 18 }} />
      ))}
    </div>
  );
}
