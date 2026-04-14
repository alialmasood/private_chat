import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaInstallPrompt from "./PwaInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "App store",
  description: "App store",
  manifest: "/manifest.webmanifest?v=5",
  appleWebApp: {
    capable: true,
    title: "App store",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/Logo1.png?v=5", type: "image/png" }],
    shortcut: [{ url: "/Logo1.png?v=5", type: "image/png" }],
    apple: [{ url: "/Logo1.png?v=5", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
