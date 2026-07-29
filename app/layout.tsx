import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi - Confidential Messaging",
  description: "Private, secure messaging with built-in NDA confidentiality protection.",
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