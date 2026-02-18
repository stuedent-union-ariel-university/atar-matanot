import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";

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
        <div className="sticky top-0 z-50 bg-[#3B7FC4] text-white py-2.5 px-4 shadow-md">
          <div className="max-w-7xl mx-auto text-center font-bold text-sm md:text-base">
            אפשר להגיש בקשה למתנה עד ל3/1/26
          </div>
        </div>
        <div
          className="absolute inset-0 bg-grid pointer-events-none"
          aria-hidden="true"
        />
        <div className="absolute top-14 right-3 sm:top-16 sm:right-4 z-10">
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
      </body>
    </html>
  );
}
