import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { NavProgress } from "@/components/NavProgress";
import { getCurrentUser } from "@/lib/auth";
import { setupComplete } from "@/lib/integrations";

export const metadata: Metadata = {
  title: "Frontdesk — Voice AI receptionist",
  description: "Your AI receptionist answers, books appointments, and follows up.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <html lang="en">
        <body>
          <NavProgress />
          <main className="min-h-screen">{children}</main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <NavProgress />
        <div className="h-screen flex overflow-hidden">
          <Sidebar setupComplete={setupComplete()} showOutreach={user.role === "admin"} />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Topbar
              user={{
                name: user.name,
                role: user.role,
                business: user.business.name,
                vertical: user.business.vertical,
              }}
            />
            <main className="flex-1 overflow-y-auto p-8 w-full">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
