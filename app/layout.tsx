import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Secure Messaging with NDA Protection",
  description:
    "End-to-end encrypted messaging with legally-binding NDA activation, government ID verification, and internationally attributable digital signatures.",
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