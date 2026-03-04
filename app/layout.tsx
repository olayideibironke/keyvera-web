import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/app/ui/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Keyvera",
  description: "Verified rental marketplace infrastructure.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-gradient-to-b from-[#f6f7f9] via-white to-[#f6f7f9] text-slate-950">
          <SiteHeader />

          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>

          <footer className="border-t border-black/5 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>© {new Date().getFullYear()} Keyvera</div>
              <div className="flex gap-6">
                <a className="hover:text-slate-950" href="#">
                  Privacy
                </a>
                <a className="hover:text-slate-950" href="#">
                  Terms
                </a>
                <a className="hover:text-slate-950" href="#">
                  Support
                </a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}