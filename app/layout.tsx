import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confi — Secure Confidential Messaging",
  description:
    "End-to-end encrypted messaging with legally binding NDA protection. Confi activates an international Non-Disclosure Agreement when Confidential Mode is enabled.",
  keywords: ["secure messaging", "NDA", "confidential", "encrypted chat"],
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
        <meta name="theme-color" content="#6C5CE7" />
      </head>
      <body>{children}</body>
    </html>
  );
}