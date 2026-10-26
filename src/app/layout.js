import "./globals.css";
import { SessionProvider } from "@/controllers/useAuthController";

export const metadata = {
  title: "E-Ambulance | Emergency Dispatch Raiganj",
  description: "Rapid 24/7 Emergency Ambulance Booking and Real-Time Telemetry Tracking for Raiganj, West Bengal",
  applicationName: "E-Ambulance",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "E-Ambulance",
  },
};

export const viewport = {
  themeColor: "#dc2626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark bg-zinc-950 text-white">
      <body className="min-h-screen bg-zinc-950 antialiased selection:bg-red-500 selection:text-white">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
