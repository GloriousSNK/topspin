import SiteNav from "@/components/SiteNav";
import Footer from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <SiteNav />
      <div style={{ flex: 1 }}>{children}</div>
      <Footer />
    </div>
  );
}
