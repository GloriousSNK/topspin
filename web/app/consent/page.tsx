import type { Metadata } from "next";
import ConsentApprove from "./ConsentApprove";

export const metadata: Metadata = {
  title: "Approve a young player",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function ConsentPage() {
  return (
    <div className="site">
      <main className="container" style={{ padding: "56px 28px 60px", flex: 1, maxWidth: 620 }}>
        <span className="eyebrow">Parent / guardian approval</span>
        <h1 className="h1" style={{ marginTop: 4 }}>Connect your player with their coach</h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          A young player in your care created a TopSpin account and would like to share their
          practice progress with their tennis coach. Your OK is needed before anything syncs.
        </p>
        <ConsentApprove />
      </main>
    </div>
  );
}
