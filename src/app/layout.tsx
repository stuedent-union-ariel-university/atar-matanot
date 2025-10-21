import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "קבלת מתנות אגודת הסטודנטים אריאל",
  description: "היי כאן תוכלו לקבל מתנות מהאגודה",
  icons: {
    icon: "/favicon.jpeg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased relative overflow-x-hidden noise-layer`}
      >
        <div
          className="absolute inset-0 bg-grid pointer-events-none"
          aria-hidden="true"
        />
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
          <Image
            src="/לוגו.png"
            alt="לוגו אגודת הסטודנטים"
            className="h-12 sm:h-16 md:h-20 w-auto select-none"
            decoding="async"
            loading="eager"
            width={120}
            height={120}
          />
        </div>
        <div className="relative z-10">{children}</div>
        <SpeedInsights />
      </body>
    </html>
  );
}
