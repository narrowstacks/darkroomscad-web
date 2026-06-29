import type { Metadata } from "next";
import { Fraunces, Montserrat } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "DarkroomSCAD — Negative Carrier Customizer",
  description: "Configure and export 3D-printable darkroom negative carriers, rendered in your browser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
