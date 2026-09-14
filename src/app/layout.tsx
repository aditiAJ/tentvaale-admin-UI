import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tentvaale Back Office",
  description: "Administration for the Tentvaale event rental business.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning because next-themes writes the theme class onto
    // <html> before React hydrates, which is by design and would otherwise be
    // reported as a mismatch on every load.
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
