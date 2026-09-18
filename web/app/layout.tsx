import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/shared/theme";
import { brandAssets } from "@/lib/brand";
import { site } from "@/lib/site";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export function generateMetadata(): Metadata {
  const logo = brandAssets();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://metacenter.vercel.app"),
    title: { default: "Metacenter · PoX-5 risk feed", template: "%s · Metacenter" },
    description: site.description,
    icons: logo.svg ? { icon: "/logo.svg" } : logo.png ? { icon: "/logo.png" } : undefined,
    openGraph: { title: "Metacenter · PoX-5 risk feed", description: site.description, type: "website" },
    twitter: { card: "summary_large_image", title: "Metacenter · PoX-5 risk feed", description: site.description },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("antialiased bg-background text-foreground", geist.variable, geistMono.variable)}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
