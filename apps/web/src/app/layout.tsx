import type { Metadata, Viewport } from "next";
import { ApiWakeGate } from "@/components/api-wake-gate";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://travel-smoky-eta.vercel.app"),
  title: {
    default: "Wayfarer — a calmer way to plan a trip",
    template: "%s · Wayfarer",
  },
  description:
    "A collaborative travel planner with an editable itinerary graph, group splits, shared notes and expense tracking.",
  applicationName: "Wayfarer",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Wayfarer",
    title: "Wayfarer — a calmer way to plan a trip",
    description:
      "A collaborative travel planner with an editable itinerary graph, group splits, shared notes and expense tracking.",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Wayfarer — a calmer way to plan a trip",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wayfarer — a calmer way to plan a trip",
    description:
      "A collaborative travel planner with an editable itinerary graph, group splits, shared notes and expense tracking.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ApiWakeGate>{children}</ApiWakeGate>
      </body>
    </html>
  );
}
