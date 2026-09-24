import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("app.title") };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
