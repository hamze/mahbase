import type { Metadata } from "next";
import { ReactNode } from "react";

import { t } from "@/lib/i18n/fa";

// Self-hosted from the npm package so the font does not depend on Google Fonts (often unreachable in Iran).
import "vazirmatn/Vazirmatn-Variable-font-face.css";
import "./globals.css";

export const metadata: Metadata = { title: t("app.title") };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
