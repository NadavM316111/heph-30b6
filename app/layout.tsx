import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Confidential Messaging",
  description:
    "Secure, legally protected messaging with NDA-backed confidentiality. Built for professionals who need real privacy.",
  manifest: "/manifest.json",
  themeColor: "#075E54",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Confi" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" content="#075E54" />
      </head>
      <body>{children}</body>
    </html>
  );
}