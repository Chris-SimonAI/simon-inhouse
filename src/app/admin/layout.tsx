'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ShoppingBag,
  LayoutDashboard,
  Library,
  Settings,
  Users,
  BarChart3,
  MessageSquare,
  Wand2,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/hotels", label: "Hotels", icon: Building2 },
  { href: "/admin/library", label: "Library", icon: Library },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/guests", label: "Guests", icon: Users },
  { href: "/admin/test-chat", label: "Test Chat", icon: MessageSquare },
  { href: "/admin/order-compiler", label: "Order Compiler", icon: Wand2 },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="fixed inset-0 flex bg-gradient-to-br from-slate-50 to-slate-100" style={{ maxWidth: 'none', margin: 0 }}>
      {/* Sidebar */}
      <aside className="w-60 bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col flex-shrink-0 shadow-xl">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-lg font-bold">S</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Simon</h1>
              <p className="text-[11px] text-slate-400 font-medium -mt-0.5">Admin Console</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-slate-500 group-hover:text-slate-300'
                    }`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="px-5 py-4 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Online
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
