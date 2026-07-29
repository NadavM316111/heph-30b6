import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Confidential Messaging",
  description: "Secure messaging with NDA-backed confidentiality. Real identity required.",
  themeColor: "#0f0c29",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}