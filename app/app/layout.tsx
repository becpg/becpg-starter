import type { Metadata } from "next";
import Assistant from "@/components/Assistant";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "beCPG Product Studio",
  description: "Product development app driven by an AI agent on top of the beCPG PLM",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main">{children}</main>
          <Assistant />
        </div>
      </body>
    </html>
  );
}
