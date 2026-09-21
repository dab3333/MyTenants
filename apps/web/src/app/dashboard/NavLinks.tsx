"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/buildings", label: "Buildings" },
  { href: "/dashboard/tenants", label: "Tenants" },
  { href: "/dashboard/payments", label: "Payments" },
  { href: "/dashboard/announcements", label: "Announcements" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

export function NavLinks() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const activeHref = LINKS.find((link) => isActive(pathname, link.href))?.href;
    const activeEl = activeHref ? linkRefs.current[activeHref] : null;
    const container = containerRef.current;
    if (!activeEl || !container) return;

    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const rect = activeEl.getBoundingClientRect();
      setIndicator({
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [pathname]);

  return (
    <nav
      ref={containerRef}
      className="relative mt-5 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm font-medium text-zinc-600"
    >
      {indicator && (
        <span
          aria-hidden
          className="absolute rounded-md bg-zinc-100 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ left: indicator.left, top: indicator.top, width: indicator.width, height: indicator.height }}
        />
      )}
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            ref={(el) => {
              linkRefs.current[link.href] = el;
            }}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`relative z-10 rounded-md px-3 py-1.5 transition-colors ${
              active ? "text-zinc-900" : "hover:text-clay-700"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
