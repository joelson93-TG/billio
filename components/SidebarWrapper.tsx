// components/SidebarWrapper.tsx
"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function SidebarWrapper() {
  const pathname = usePathname();

  // / (landing), /login et /signup sont gérés par les route groups (pas de sidebar).
  // On conserve uniquement la règle pour l'espace admin.
  const shouldHideSidebar = pathname?.startsWith("/admin");

  if (shouldHideSidebar) {
    return null;
  }

  return <Sidebar />;
}