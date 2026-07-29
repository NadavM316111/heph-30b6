import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Secure Confidential Messaging",
  description: "WhatsApp-style messaging with NDA-backed confidential conversations. Your messages, legally protected.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'><circle cx='36' cy='36' r='36' fill='%236C63FF'/></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}