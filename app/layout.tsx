import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fg-license — License Server",
  description: "JWT-based feature license server",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 font-mono">{children}</body>
    </html>
  );
}
