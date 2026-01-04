import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Plateforme de gestion de vaccination",
  description: "Plateforme de gestion de vaccination",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-slate-50 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
