import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/app/ui/site-header";
import SiteFooter from "@/app/ui/site-footer";

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
      <body className="antialiased">
        <div className="min-h-screen bg-[var(--kv-bg)] text-[var(--kv-body)]">
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
