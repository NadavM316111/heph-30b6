import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Confidential Messaging",
  description:
    "Secure, phone-verified messaging with legally binding NDA protection for confidential conversations.",
  keywords: ["confidential messaging", "encrypted chat", "NDA", "secure messaging"],
  openGraph: {
    title: "Confi — Confidential Messaging",
    description: "Phone-verified identity. End-to-end encrypted. NDA-backed conversations.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f0f1a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔒</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}