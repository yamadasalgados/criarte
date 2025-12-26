import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CriArte",
  description: "Catálogo + Vendas + Chat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light">
      <body className="min-h-screen bg-app text-app">{children}</body>
    </html>
  );
}
