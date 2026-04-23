import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Revline",
  description: "AI appointment & opportunity engine for dealerships",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-surface-border bg-white">
            <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
              <Link href="/" className="font-semibold tracking-tight">
                Revline
              </Link>
              <nav className="flex gap-4 text-sm">
                <Link href="/rep" className="hover:text-lane">Rep feed</Link>
                <Link href="/manager" className="hover:text-lane">Manager</Link>
                <Link href="/service" className="hover:text-lane">Service</Link>
                <Link href="/settings" className="hover:text-lane">Setup</Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto p-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
