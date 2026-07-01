import Link from "next/link";
import BrandMark from "./BrandMark";
import MobileMenu from "./MobileMenu";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/learn", label: "Learn" },
  { href: "/insights", label: "Insights" },
  { href: "/about", label: "About" },
];

export default function SiteNav() {
  return (
    <header className="navbar">
      <div className="container">
        <div className="navbar-inner">
          <BrandMark href="/" />
          <nav className="navlinks">
            {LINKS.map((l) =>
              // In-page anchors use a plain <a> so they scroll reliably on the
              // first click (Next's <Link> can swallow same-route hash scrolls).
              l.href.includes("#") ? (
                <a key={l.href} href={l.href}>{l.label}</a>
              ) : (
                <Link key={l.href} href={l.href}>{l.label}</Link>
              )
            )}
          </nav>
          <span className="nav-spacer" />
          <Link href="/analyze" className="btn">Open the app</Link>
          <MobileMenu links={LINKS} cta={{ href: "/analyze", label: "Open the app" }} />
        </div>
      </div>
    </header>
  );
}
