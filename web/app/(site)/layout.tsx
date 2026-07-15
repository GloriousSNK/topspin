import TopNav from "@/components/TopNav";
import Footer from "@/components/Footer";
import { AutoReveal } from "@/components/lp/Playground";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <TopNav />
      <main id="main-content" style={{ flex: 1 }}>{children}</main>
      <AutoReveal />
      <Footer />
    </div>
  );
}
