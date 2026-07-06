import TopNav from "@/components/TopNav";
import Footer from "@/components/Footer";
import { AutoReveal } from "@/components/lp/Playground";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <TopNav />
      <div style={{ flex: 1 }}>{children}</div>
      <AutoReveal />
      <Footer />
    </div>
  );
}
