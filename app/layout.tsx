import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monstro Quest - A Retro Monster RPG",
  description: "Catch monsters, battle trainers, and become the champion of the Verdant Region.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
