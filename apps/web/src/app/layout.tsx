import { GeistSans } from "geist/font/sans";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-screen bg-white font-sans text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
