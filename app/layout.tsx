import type { Metadata } from "next";
import "./globals.css";
import "./responsive-shell.css";
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
        <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[var(--kv-bg)] text-[var(--kv-body)]">
          <SiteHeader />

          <main className="w-full min-w-0 max-w-full overflow-x-clip">
            {children}
          </main>

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}