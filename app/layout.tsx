import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Encrypted Messaging with NDA Protection",
  description:
    "Confi is a secure messaging app where turning on Confidential Mode activates an international NDA that covers your conversation under the rules of confidentiality.",
  manifest: "/manifest.json",
  themeColor: "#0f172a",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Confi",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}