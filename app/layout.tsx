import type { Metadata } from "next";
import localFont from "next/font/local";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { SmoothScrollProvider } from "@/app/components/smooth-scroll-provider";
import { Navbar } from "@/app/components/navbar";
import { AiChat } from "@/app/components/ai-chat";
import "./globals.css";

const samarkanDisplay = localFont({
  src: "../public/font/samarkan/samarn.ttf",
  variable: "--font-display",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.naarithread.com"),
  title: {
    default: "NaariThread | Premium Indian Fashion for Women",
    template: "%s | NaariThread",
  },
  description:
    "Shop premium women clothing online at NaariThread. Explore ethnic wear, western wear, bottom wear, and fusion styles crafted for modern Indian women.",
  keywords: [
    "NaariThread",
    "Indian women clothing",
    "ethnic wear",
    "western wear women",
    "fusion wear",
    "saree",
    "kurti",
    "lehenga",
    "women fashion India",
    "online women clothing store",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NaariThread | Wear Your Story",
    description:
      "From timeless sarees to modern silhouettes, discover premium styles for every chapter of your journey.",
    url: "/",
    siteName: "NaariThread",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "NaariThread brand logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NaariThread | Wear Your Story",
    description:
      "Premium Indian fashion for women across ethnic, western, bottom, and fusion wear.",
    images: ["/logo.png"],
  },
  category: "fashion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${samarkanDisplay.variable} ${plusJakartaSans.variable} bg-paper text-primary antialiased`}>
        <Navbar />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
        <AiChat />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
