"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function SidebarWrapper() {
  const pathname = usePathname();

  // ⭐ On ajoute "/" pour cacher la sidebar sur la landing page
  const hideSidebarRoutes = ["/", "/login", "/signup"];

  const shouldHideSidebar = hideSidebarRoutes.includes(pathname) || pathname?.startsWith("/admin");

  if (shouldHideSidebar) {
    return null;
  }

  return <Sidebar />;
}