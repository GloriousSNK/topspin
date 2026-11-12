import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What TopSpin stores, what it never collects, and how to delete your data.",
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
          Privacy policy
        </h1>
        <p style={{ fontSize: 17, color: "var(--ink-soft)", lineHeight: 1.65, marginBottom: 36 }}>
          You can use all of TopSpin, including clip analysis, drills, the Ball Lab and stats,
          without an account. We don&apos;t use ad trackers or analytics cookies. If you sign in, we
          use the cookies needed to keep you signed in. Here&apos;s what we store and when.
        </p>

        <Section title="What we collect from every visitor">
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            <li>• The <strong style={{ color: "var(--ink)" }}>pages you visit</strong> (for example <code className="mono">/learn</code>). We remove anything after a &quot;?&quot; in the address before saving it.</li>
            <li>• The <strong style={{ color: "var(--ink)" }}>website that sent you here</strong>, if any. We keep only the site&apos;s address (for example <code className="mono">https://google.com</code>), not the full link.</li>
            <li>• Your <strong style={{ color: "var(--ink)" }}>country</strong>, worked out from your network. We never record a more precise location.</li>
            <li>• A <strong style={{ color: "var(--ink)" }}>visitor code</strong> so we can count unique visitors. Our server makes it by mixing your IP address and browser type with a secret key, and only the result is saved. It can&apos;t be turned back into your IP address. If the server can&apos;t see an IP address, it uses a random id stored in your browser instead.</li>
            <li>• <strong style={{ color: "var(--ink)" }}>Counts</strong> of analyses, simulations and practice sessions, which are not linked to you.</li>
          </ul>
        </Section>

        <Section title="What we never collect">
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            <li>• Your <strong style={{ color: "var(--ink)" }}>videos</strong>. They are analysed in your browser and never uploaded.</li>
            <li>• Your <strong style={{ color: "var(--ink)" }}>IP address</strong>. We use it briefly to block abuse and to make the visitor code above, and then it&apos;s thrown away.</li>
            <li>• Advertising cookies, social media pixels or outside analytics services.</li>
            <li>• Mouse movements, scrolling, keystrokes or device fingerprints.</li>
          </ul>
        </Section>

        <Section title="If you create an account">
          Accounts are optional. If you sign up, we store your <strong style={{ color: "var(--ink)" }}>email
          address</strong>, your <strong style={{ color: "var(--ink)" }}>birth year</strong> (just the year,
          for the age check below), and the <strong style={{ color: "var(--ink)" }}>analyses you save</strong>
          {" "}(stroke, form score, problems found and serve estimate) so you can track your progress.
          Sign-in is handled by Supabase, and we never see your password. We don&apos;t sell or share your
          data. You can delete your saved analyses, or your whole account, from the account page.
        </Section>

        <Section title="Connecting with a coach">
          Connecting with a coach is up to you. If you enter a coach&apos;s squad code, the coach sees a
          {" "}<strong style={{ color: "var(--ink)" }}>summary</strong>{" "}of your practice: form scores, drills
          completed and dates. They don&apos;t see your videos or full stroke breakdowns. Sending a coach a
          specific breakdown is a separate step you take yourself. If you leave the squad or delete your
          account, the summaries shared with that coach are deleted too.
        </Section>

        <Section title="Players under 16">
          If your birth year shows you may be under 16, you can still use everything on your own device,
          but connecting with a coach needs a parent or guardian to approve it first. For that we store
          the <strong style={{ color: "var(--ink)" }}>guardian email address you give us</strong>{" "}and send
          them a one-time approval link that expires. Nothing is shared with a coach until they approve,
          and either of you can undo it later. This is how we try to follow COPPA (US, under 13) and GDPR
          (under 16). It isn&apos;t legal advice.
        </Section>

        <Section title="Coaches keeping student folders">
          Coaches can keep a private folder for each student they film, even if the student has no
          account. A folder holds a name or nickname the coach types, the coach&apos;s notes, and the
          analysis results. It never holds the video, the student&apos;s age or contact details. Only the
          coach who made a folder can see it, and deleting the folder deletes everything in it. If
          you&apos;re a coach, please only use a first name or nickname, and delete folders you no longer need.
        </Section>

        <Section title="Shared summaries and parent reports">
          If you create a shareable summary, anyone with the link can open it. It shows the stroke
          breakdown and suggested drills, but not your name, so only share the link with people you want
          to see it. Coaches can also create parent reports with recent scores and practice counts.
          These use long links that can&apos;t be guessed and stop working after 30 days. Anyone with a
          report link can open it, so treat it like any other private link.
        </Section>

        <Section title="Where your data is kept">
          Visit counts are kept in our own database. Account data is kept in Supabase. We don&apos;t use
          an outside analytics company. Visit records are capped, and the oldest ones are deleted
          automatically.
        </Section>

        <Section title="Deleting your data">
          Without an account, you can clear the random id in your browser by clearing this site&apos;s
          data in your browser settings. With an account, you can delete your saved analyses or your
          whole account, including anything shared with a coach, from the account page.
        </Section>

        <Section title="Changes to this policy">
          If this policy changes, we&apos;ll update this page. Questions? See the{" "}
          <Link href="/about" style={{ color: "var(--court)", fontWeight: 600 }}>about page</Link>.
        </Section>

        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
          TopSpin is a personal project. This page is a plain-English summary of how it handles data,
          not legal advice.
        </p>
      </div>
    </section>
  );
}
