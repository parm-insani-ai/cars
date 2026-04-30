import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Revline",
  description: "AI appointment & opportunity engine for dealerships",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Login layout has no chrome.
  if (!user) {
    return (
      <html lang="en">
        <body>
          <main className="min-h-screen">{children}</main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex">
          <Sidebar currentRepId={user.role === "rep" ? user.id : null} />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar
              user={{
                id: user.id,
                name: user.name,
                role: user.role,
                rooftop: user.rooftop.name,
              }}
            />
            <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
