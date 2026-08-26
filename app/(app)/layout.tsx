// app/(app)/layout.tsx
"use client";

import Script from "next/script";
import SidebarWrapper from "@/components/SidebarWrapper";
import PageShell from "@/components/PageShell";
import SubscriptionProvider from "@/components/SubscriptionProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SubscriptionProvider>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col md:flex-row">
        <Script
          src="https://checkout.fedapay.com/js/fedapay.js"
          strategy="afterInteractive"
        />
        <SidebarWrapper />
        <PageShell>{children}</PageShell>
      </div>
    </SubscriptionProvider>
  );
}