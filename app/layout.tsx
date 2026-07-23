import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = "FocusFlow — 集中と休息を、いいリズムで";
const description = "ポモドーロ、作業記録、スマート休憩、通知抑制、会議前チェックをひとつにした作業管理アプリ。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title, description, applicationName: "FocusFlow", manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "FocusFlow" },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/favicon.svg" },
    openGraph: { title, description, type: "website", images: [{ url: image, width: 1536, height: 1024, alt: "FocusFlow 作業管理アプリ" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export const viewport: Viewport = { themeColor: "#f4f6f0", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
