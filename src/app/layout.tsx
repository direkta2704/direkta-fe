import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import Providers from "./providers";
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
  title: "Direkta — Sell your property. Direct.",
  description:
    "Direkta is a complete software-driven sales process for German homeowners. Listing, pricing, qualified leads, offers, and notary — all in one place. No 3.57% commission.",
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
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background-light text-blueprint overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
