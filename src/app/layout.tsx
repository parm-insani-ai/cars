import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { NavProgress } from "@/components/NavProgress";
import { getCurrentUser } from "@/lib/auth";
import { setupComplete } from "@/lib/integrations";

export const metadata: Metadata = {
  metadataBase: new URL("https://insani.ai"),
  title: {
    default: "Insani AI — AI receptionist for Halifax small businesses",
    template: "%s · Insani AI",
  },
  description:
    "Stop missing calls. Insani's AI receptionist answers every call, books appointments, and follows up — built for small businesses in Halifax and across Nova Scotia.",
  keywords: [
    "AI receptionist",
    "AI phone answering",
    "Halifax small business",
    "appointment booking",
    "virtual receptionist Canada",
    "Nova Scotia",
    "voice AI",
  ],
  openGraph: {
    title: "Insani AI — Never miss a call again",
    description:
      "AI receptionist that answers, books, and follows up — built for Halifax small businesses.",
    url: "https://insani.ai",
    siteName: "Insani AI",
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Insani AI — Never miss a call again",
    description:
      "AI receptionist that answers, books, and follows up — built for Halifax small businesses.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
            <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
