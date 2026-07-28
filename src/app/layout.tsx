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
    default: "Insani AI — AI for Service Businesses",
    template: "%s · Insani AI",
  },
  description:
    "Insani's AI employee answers every call, books appointments, follows up, and carries out tasks specific to your business.",
  keywords: [
    "AI for service businesses",
    "AI employee",
    "AI receptionist",
    "AI phone answering",
    "appointment booking",
    "virtual receptionist Canada",
    "Halifax",
    "Nova Scotia",
    "voice AI",
  ],
  openGraph: {
    title: "Insani AI — AI for Service Businesses",
    description:
      "Insani's AI employee answers every call, books appointments, follows up, and carries out tasks specific to your business.",
    url: "https://insani.ai",
    siteName: "Insani AI",
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Insani AI — AI for Service Businesses",
    description:
      "Insani's AI employee answers every call, books appointments, follows up, and carries out tasks specific to your business.",
  },
  robots: {
    index: true,
    follow: true,
  },
  // Add-to-Home-Screen support so the operator can pin insani GTM to their
  // phone home screen and it opens fullscreen (no browser chrome) like an app.
  manifest: "/manifest.json",
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    title: "insani",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  // Lets the site occupy the notch area on iOS when installed as a PWA.
  viewportFit: "cover" as const,
  themeColor: "#0f172a",
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
