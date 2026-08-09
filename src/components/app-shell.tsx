"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavItems } from "@/lib/registry";
import { iconMap } from "./icons";
import { ThemeSwitcher } from "./theme-switcher";
import { cn } from "@/lib/utils";
import { useTagPanel } from "@/lib/tag-panel-context";
import { TagPanel } from "./tag-panel";
import { BookOpen, Tags } from "lucide-react";
import "@/modules";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navItems = getNavItems();
  const { open, setOpen } = useTagPanel();

  return (
    <div className="flex min-h-screen">
      {/* 左侧导航 */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-52 flex-col border-r border-border bg-surface">
        <Link
          href="/"
          className="flex h-14 items-center gap-2 border-b border-border px-4"
        >
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-base font-bold">WordLink</span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const Icon = item.icon ? iconMap[item.icon] : undefined;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <button
            onClick={() => setOpen(!open)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              open
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-surface-2 hover:text-text"
            )}
          >
            <Tags className="h-4 w-4" />
            标签面板
          </button>
          <ThemeSwitcher />
        </div>
      </aside>

      {/* 中间内容 */}
      <main
        className={cn(
          "min-w-0 flex-1 transition-[padding]",
          open ? "pl-52 pr-[300px]" : "pl-52"
        )}
      >
        <div className="mx-auto max-w-3xl px-5 py-6">{children}</div>
      </main>

      {/* 右侧标签面板 */}
      {open && (
        <aside className="fixed inset-y-0 right-0 z-40 w-[300px] border-l border-border bg-surface">
          <TagPanel />
        </aside>
      )}
    </div>
  );
}
