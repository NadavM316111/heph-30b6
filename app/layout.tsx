import "./globals.css";
import InstallPrompt from "./components/InstallPrompt";

export const metadata = {
  title: "Confi Messaging App",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Confi Messaging App" },
};
export const viewport = { themeColor: "#0b1020", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
