"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function SidebarWrapper() {
  const pathname = usePathname();

  // Liste des chemins exacts où la barre latérale doit être cachée
  const hideSidebarRoutes = ["/login", "/signup"];

  // Vérifie si on est sur une page d'authentification ou dans la section admin
  const shouldHideSidebar = hideSidebarRoutes.includes(pathname) || pathname?.startsWith("/admin");

  if (shouldHideSidebar) {
    return null;
  }

  // Sinon, on affiche la barre latérale normalement
  return <Sidebar />;
}