import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SmoothScrollProvider } from "@/app/components/smooth-scroll-provider";
import "./globals.css";

const comfortaa = Comfortaa({
  variable: "--font-brand",
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
      <body className={`${comfortaa.variable} bg-paper text-primary antialiased`}>
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
