"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Tableau de bord",
      fullName: "Tableau de bord",
      href: "/",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      name: "Factures",
      fullName: "Factures",
      href: "/factures",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: "Clients",
      fullName: "Clients",
      href: "/clients",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      name: "Paramètres", 
      fullName: "Paramètres Société",
      href: "/settings",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <aside 
      className="z-50 shrink-0 print:hidden 
                 /* --- Mobile: Navigation fixe tout en haut --- */
                 fixed top-0 left-0 right-0 h-16 flex flex-row items-center justify-between 
                 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3
                 
                 /* --- Desktop: Barre latérale classique à gauche --- */
                 md:sticky md:top-0 md:h-screen md:w-64 md:flex-col md:justify-start 
                 md:bg-slate-900 md:border-b-0 md:border-r md:px-0 md:shadow-xl md:shadow-slate-900/10"
    >
      
      {/* Logo & Marque */}
      <div className="flex items-center gap-2.5 shrink-0 md:h-16 md:px-6 md:border-b md:border-slate-800 md:w-full">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm shadow-sm">
          B
        </div>
        <span className="text-base sm:text-lg font-bold text-white tracking-tight">Billio.</span>
      </div>
      
      {/* Menu principal */}
      <nav aria-label="Menu principal" className="flex-1 flex items-center justify-end md:flex-col md:justify-start md:items-stretch md:w-full md:overflow-y-auto">
        <ul className="flex flex-row items-center space-x-1 sm:space-x-2 
                       md:flex-col md:justify-start md:space-x-0 md:space-y-1.5 md:px-3 md:py-6 md:w-full">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            
            return (
              <li key={item.href} className="md:w-full">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={item.fullName || item.name}
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 group
                             md:flex-row md:justify-start md:gap-3 md:px-4 md:py-3 md:text-sm md:font-medium
                             ${isActive
                               ? "text-blue-400 bg-blue-500/10 md:bg-blue-600 md:text-white md:shadow-md md:shadow-blue-600/20"
                               : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 md:hover:text-white md:hover:bg-slate-800"
                             }`}
                >
                  <span className={`transition-transform duration-200 ${isActive ? "scale-110 md:scale-100" : "group-hover:scale-110 md:group-hover:scale-100"}`}>
                    {item.icon}
                  </span>
                  
                  {/* Libellé */}
                  <span className="hidden md:inline text-sm font-medium leading-tight truncate">
                    {item.fullName || item.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bouton Déconnexion en rouge vif */}
      <div className="flex shrink-0 ml-1 md:ml-0 md:p-4 md:border-t md:border-slate-800 md:w-full">
        <Link 
          href="/login" 
          title="Déconnexion"
          className="flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 group
                     md:flex-row md:justify-start md:gap-3 md:px-4 md:py-3 md:text-sm md:font-medium
                     text-red-500 hover:text-red-400 hover:bg-red-500/10"
        >
          <svg className="w-5 h-5 text-red-500 group-hover:text-red-400 group-hover:scale-110 md:group-hover:scale-100 transition-all duration-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden md:inline text-sm font-medium leading-tight truncate text-left">
            Déconnexion
          </span>
        </Link>
      </div>
    </aside>
  );
}