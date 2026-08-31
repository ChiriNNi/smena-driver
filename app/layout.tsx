import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OVI — Смена",
  description: "Управление сменами водителей",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
