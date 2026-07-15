import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
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
          You can use every part of TopSpin — analysis, drills, the Ball Lab, stats — with no
          account at all, and if you do, we still collect nothing personal beyond what you give us.
          No ad trackers or analytics cookies. Signed-in accounts use essential session cookies. Accounts are optional, and exist
          mainly so a player can <em>choose</em> to connect with a coach. Here&apos;s exactly
          what&apos;s stored, and when.
        </p>

        <Section title="What we collect">
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            <li>• An <strong style={{ color: "var(--ink)" }}>anonymous id</strong> kept in your browser&apos;s local storage. It isn&apos;t tied to your name or email; it just tells a returning browser from a new one.</li>
            <li>• The <strong style={{ color: "var(--ink)" }}>page paths</strong> you view (e.g. <code className="mono">/learn</code>). Query strings are stripped before anything is stored.</li>
            <li>• A <strong style={{ color: "var(--ink)" }}>tally</strong> of analyses, simulations, and workouts run. Just counts, with nothing tied to you.</li>
            <li>• The <strong style={{ color: "var(--ink)" }}>origin</strong> of the site that linked you here (e.g. <code className="mono">https://google.com</code>), never the full URL.</li>
          </ul>
        </Section>

        <Section title="What we never collect">
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            <li>• No personal data at all unless you choose to make an account.</li>
            <li>• No advertising cookies and no third-party analytics, ads, or social pixels. Essential authentication cookies are used only while you&apos;re signed in.</li>
            <li>• No <strong style={{ color: "var(--ink)" }}>IP addresses stored</strong>. Your IP is used for a split second to rate-limit abuse, then discarded.</li>
            <li>• No mouse movement, scroll tracking, keystrokes, or device fingerprinting.</li>
          </ul>
        </Section>

        <Section title="If you make an account (optional)">
          Only if you sign up, we store your <strong style={{ color: "var(--ink)" }}>email</strong>, your
          <strong style={{ color: "var(--ink)" }}> birth year</strong> (a single year, for the age check
          below — never a full date of birth), and the
          <strong style={{ color: "var(--ink)" }}> analyses you save</strong> (stroke, form score, flaws, serve
          estimate) so you can track progress. Auth is handled by Supabase. We don&apos;t see or store your
          password, and we never sell or share any of it. You can delete saved analyses or permanently delete the account from the account page.
        </Section>

        <Section title="Coaches, squads & connecting with one">
          A coach connection is <strong style={{ color: "var(--ink)" }}>opt-in</strong>. If you enter a
          coach&apos;s squad code, only a <strong style={{ color: "var(--ink)" }}>summary</strong> of your
          practice syncs to them — form scores, drills completed, and dates. Your video and full stroke
          breakdown stays private; sending a specific analysis breakdown to a coach is always a separate,
          deliberate choice. The clip itself stays on your device. Leaving the squad or deleting your account stops the sync and removes the
          summary data we held for that connection.
        </Section>

        <Section title="Younger players & parental consent">
          If your birth year says you may be under 16, you can still use the whole app on your device, but
          connecting with a coach needs a parent or guardian&apos;s approval first. For that we store the
          <strong style={{ color: "var(--ink)" }}> guardian email you provide</strong> and send them a
          one-time, expiring approval link. Nothing syncs to a coach until they approve, and they (or you)
          can undo it at any time. This is our good-faith approach to COPPA (US, under 13) and GDPR
          (under 16); it isn&apos;t legal advice.
        </Section>

        <Section title="Your video clips">
          Clip analysis runs entirely in your browser. Your video is never uploaded, never stored, and
          never leaves your device — with or without an account. Only the resulting numbers are saved, and
          only if you&apos;re signed in. When you close the tab, the clip is gone.
        </Section>

        <Section title="Shared summaries">
          If you create a shareable coach summary, it lives at a public link that anyone with the URL can
          open. It contains the stroke read and suggested drills, not your identity. Only make one if
          you&apos;re happy to hand out the link.
        </Section>

        <Section title="Coach notes and parent reports">
          A linked coach can add a short note only to an analysis you deliberately shared with that coach.
          Coaches can also create a report containing recent summary scores and practice counts. Reports
          use long, unguessable links and expire after 30 days. Anyone holding a report link can open it,
          so handle it like any other private link.
        </Section>

        <Section title="Where the data lives">
          Traffic counts sit in our own database; account data sits in Supabase. No analytics SaaS is in
          the loop. Anonymous traffic records are capped and old ones are pruned automatically.
        </Section>

        <Section title="Your control">
          Browsing anonymously, the only identifier lives in your browser, so you can reset it by clearing
          local storage. With an account, you can wipe your saved analyses from the account page, and ask
          permanently delete the account and its synced data from the account page.
        </Section>

        <Section title="Changes">
          If this policy changes, the new version lives here. Questions? See the{" "}
          <Link href="/about" style={{ color: "var(--court)", fontWeight: 600 }}>about page</Link>.
        </Section>

        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
          TopSpin is a personal project. This is a good-faith, plain-English summary of how it handles
          data, not legal advice.
        </p>
      </div>
    </section>
  );
}
