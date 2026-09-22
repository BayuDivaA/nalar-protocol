import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Nalar Protocol",
  description: "Understand what you are signing before it reaches your wallet.",
  icons: {
    icon: [
      { url: "/brand/n-dark.svg", media: "(prefers-color-scheme: dark)", type: "image/svg+xml" },
      { url: "/brand/n-light.svg", media: "(prefers-color-scheme: light)", type: "image/svg+xml" },
      { url: "/brand/n-dark.svg", type: "image/svg+xml" },
    ],
    shortcut: "/brand/n-dark.svg",
    apple: "/brand/n-dark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nalar-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}else{document.documentElement.setAttribute('data-theme','dark')}}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()`,
          }}
        />
      </head>
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
