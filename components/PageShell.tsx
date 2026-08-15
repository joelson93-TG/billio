// components/PageShell.tsx
"use client";

import { usePathname } from "next/navigation";

export default function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // /admin n'a pas besoin du padding standard du dashboard.
  const noPadding = pathname?.startsWith("/admin");

  return (
    <main
      className={`flex-1 flex flex-col min-w-0 bg-[#F8FAFC] min-h-screen ${
        noPadding ? "" : "pt-16 md:pt-0"
      }`}
    >
      {children}
    </main>
  );
}