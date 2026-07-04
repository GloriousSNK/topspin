import TopNav from "@/components/TopNav";
import Footer from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <TopNav />
      <div style={{ flex: 1 }}>{children}</div>
      <Footer />
    </div>
  );
}
