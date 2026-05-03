import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nexus-402 | Agent Labor Market",
  description: "Decentralized agent-to-agent labor market on Solana — Frontier Hackathon 2026",
  keywords: ["Solana", "AI agents", "x402", "DeFi", "FinBERT"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
