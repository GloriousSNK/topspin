import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — TopSpin",
  description: "What TopSpin collects (very little), what it never collects, and why.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 22, fontWeight: 600, marginBottom: 10 }}>{title}</h2>
      <div style={{ color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

export default function Privacy() {
  return (
    <section className="section" style={{ paddingTop: 60 }}>
      <div className="container" style={{ maxWidth: 780 }}>
        <span className="eyebrow">Privacy</span>
        <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "clamp(32px,5vw,44px)", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.06, marginBottom: 12 }}>
          The short version: we barely track you.
        </h1>
        <p style={{ fontSize: 17, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 36 }}>
          TopSpin has no accounts, no cookies, and no third-party trackers or ad networks. We keep a
          small, anonymous count of traffic so we can see whether the thing is useful — that&apos;s it.
          Here&apos;s exactly what that means.
        </p>

        <Section title="What we collect">
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            <li>• An <strong style={{ color: "var(--ink)" }}>anonymous id</strong> generated at random and kept in your browser&apos;s local storage. It isn&apos;t tied to your name, email, or anything about you — it just lets us tell a returning browser from a new one.</li>
            <li>• The <strong style={{ color: "var(--ink)" }}>page paths</strong> you view on this site (e.g. <code className="mono">/learn</code>). Any query string is stripped before it&apos;s ever stored.</li>
            <li>• A <strong style={{ color: "var(--ink)" }}>count</strong> each time a clip is submitted for AI analysis — this is the &quot;people helped&quot; number.</li>
            <li>• The <strong style={{ color: "var(--ink)" }}>origin</strong> of the site that linked you here (e.g. <code className="mono">https://google.com</code>) — never the full URL.</li>
          </ul>
        </Section>

        <Section title="What we never collect">
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            <li>• No names, emails, or accounts — there&apos;s nothing to sign up for.</li>
            <li>• No cookies and no third-party analytics, ads, or social pixels.</li>
            <li>• No <strong style={{ color: "var(--ink)" }}>IP addresses stored</strong>. Your IP is used for a split second only to rate-limit abuse, then discarded — it&apos;s never written down.</li>
            <li>• No mouse movement, scroll tracking, keystrokes, or device fingerprinting.</li>
          </ul>
        </Section>

        <Section title="Video clips you upload">
          Clips you send for analysis are stored temporarily on the server only to run the analysis,
          and are removed automatically as storage cycles. They aren&apos;t shared, sold, or used to
          train anything, and they aren&apos;t linked to your identity.
        </Section>

        <Section title="Where the data lives">
          Everything is kept in our own database — no analytics SaaS is involved, so your activity
          isn&apos;t handed off to a third party. Traffic records are capped and old ones are pruned
          automatically; they aren&apos;t retained indefinitely.
        </Section>

        <Section title="Your control">
          Because the only identifier is stored in your browser, you can reset it any time by clearing
          this site&apos;s local storage (or using a private window). There&apos;s nothing server-side
          tied to you to delete.
        </Section>

        <Section title="Changes">
          If this policy ever changes, the updated version will live on this page. Questions? See the{" "}
          <Link href="/about" style={{ color: "var(--court)", fontWeight: 600 }}>about page</Link>.
        </Section>

        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
          TopSpin is a personal project and this policy describes a good-faith, plain-English summary
          of how it handles data — it isn&apos;t legal advice.
        </p>
      </div>
    </section>
  );
}
