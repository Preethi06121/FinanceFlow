import localFont from "next/font/local";

import type { Metadata } from "next";

import { ThemeProvider } from "@/components/theme-provider";
import "@/styles/globals.css";

const dmSans = localFont({
  src: [
    { path: "../../fonts/dm-sans/DMSans-Regular.ttf", weight: "400" },
    { path: "../../fonts/dm-sans/DMSans-Medium.ttf", weight: "500" },
    { path: "../../fonts/dm-sans/DMSans-SemiBold.ttf", weight: "600" },
    { path: "../../fonts/dm-sans/DMSans-Bold.ttf", weight: "700" },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "FinanceFlow", template: "%s | FinanceFlow" },
  description: "FinanceFlow financial data, reconciliation and exception management.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
