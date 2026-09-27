import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dubai Off-Plan Research Desk | Mokhamed",
  description: "Evidence-based single-agent research dashboard for Dubai off-plan real estate investment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="antialiased bg-slate-50 text-slate-900 selection:bg-sky-500/20 selection:text-sky-900 font-sans min-h-screen"
      >
        {children}
      </body>
    </html>
  );
}
