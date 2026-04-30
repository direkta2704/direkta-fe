import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import Providers from "./providers";
import CookieBanner from "./components/cookie-banner";
import TranslateSafe from "./components/translate-safe";
import PostHogProvider from "./components/posthog-provider";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Direkta — Immobilie verkaufen. Direkt.",
  description:
    "Direkta ist ein vollständiger, softwaregestützter Verkaufsprozess für deutsche Immobilienbesitzer. Inserat, Preisfindung, qualifizierte Interessenten, Angebote und Notar — alles an einem Ort. Keine 3,57% Provision.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${bricolage.variable} ${manrope.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background-light text-blueprint overflow-x-hidden" suppressHydrationWarning>
        <TranslateSafe>
          <Providers>
            <PostHogProvider />
            {children}
          </Providers>
          <CookieBanner />
        </TranslateSafe>
      </body>
    </html>
  );
}
