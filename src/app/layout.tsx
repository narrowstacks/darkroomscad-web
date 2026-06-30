import type { Metadata } from "next";
import { Fraunces, Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { THEMES } from "@/lib/theme/themes";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "DarkroomSCAD — Negative Carrier Customizer",
  description: "Configure and export 3D-printable darkroom negative carriers, rendered in your browser.",
};

// Build a { themeName: cssVars } map at server render time and embed it as a
// JSON literal so the inline script can apply the full var set before paint —
// eliminates the flash for users with a persisted non-dark theme.
const themeVarsMap = Object.fromEntries(
  Object.entries(THEMES).map(([name, tokens]) => [name, tokens.vars])
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
(function(){try{
  var VARS=${JSON.stringify(themeVarsMap)};
  var t=localStorage.getItem('darkroomscad-theme');
  var valid=['dark','light','darkroom','high-contrast'];
  if(valid.indexOf(t)<0){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
  document.documentElement.setAttribute('data-theme',t);
  var vars=VARS[t];
  if(vars){var el=document.documentElement;Object.keys(vars).forEach(function(k){el.style.setProperty(k,vars[k]);});}
}catch(e){}})();
        `}} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
