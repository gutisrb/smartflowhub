import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartFlow Client Dashboard",
  description: "AI-Powered Lead Acquisition & CRM Unified Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} antialiased selection:bg-emerald/30 selection:text-emerald`}
      >
        {children}
      </body>
    </html>
  );
}
