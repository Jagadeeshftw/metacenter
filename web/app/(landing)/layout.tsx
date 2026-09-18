import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { brandAssets } from "@/lib/brand";
import { getMeta } from "@/lib/api";

export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  const hasLogo = brandAssets().svg;
  const meta = await getMeta();
  return (
    <>
      <Navbar hasLogo={hasLogo} />
      {children}
      <Footer hasLogo={hasLogo} reader={meta?.reader ?? null} feed={meta?.feed ?? "ST24MYZSDF0TAVZ452R2TJY3RCQAVT3KR0FJHYCAJ.risk-feed"} />
    </>
  );
}
