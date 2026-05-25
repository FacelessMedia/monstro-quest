import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monstro Quest - A Retro Monster RPG",
  description: "Catch monsters, battle trainers, and become the champion of the Verdant Region.",
};

// Mobile-friendly viewport: lock zoom so the touch controls + canvas stay stable while playing.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0b16",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
