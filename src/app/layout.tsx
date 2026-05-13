import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
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
        <body><main className="min-h-screen">{children}</main></body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex">
          <Sidebar setupComplete={setupComplete()} />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar
              user={{
                name: user.name,
                role: user.role,
                business: user.business.name,
                vertical: user.business.vertical,
              }}
            />
            <main className="flex-1 p-8 max-w-7xl w-full mx-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
