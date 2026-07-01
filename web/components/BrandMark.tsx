import Link from "next/link";

/** The TopSpin logo lockup — a tennis-ball dot with a seam + wordmark. */
export default function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand-link">
      <span className="brand-dot" />
      <span>
        <span className="brand-name">TopSpin</span>
        <span className="brand-sub" style={{ display: "block" }}>Practice Lab</span>
      </span>
    </Link>
  );
}
