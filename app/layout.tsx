import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Secure Confidential Messaging",
  description:
    "Confi is a secure messaging platform with built-in NDA activation, end-to-end encryption, and minimal PII storage.",
  keywords: ["secure messaging", "confidential", "NDA", "encrypted chat"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}