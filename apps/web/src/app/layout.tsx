import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
