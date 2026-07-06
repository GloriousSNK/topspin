import TopNav from "@/components/TopNav";
import Footer from "@/components/Footer";
import { AutoReveal } from "@/components/lp/Playground";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <TopNav />
      <main className="container" style={{ padding: "40px 28px 60px", flex: 1 }}>
        {children}
      </main>
      <AutoReveal />
      <Footer />
    </div>
  );
}
