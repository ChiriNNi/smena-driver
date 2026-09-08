import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smena",
  description: "Управление сменами водителей",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- это корневой layout приложения (app router), а не pages/_document — правило рассчитано на старый Pages Router */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
