"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MooBotMascot } from "@/components/MooBotMascot";
import { CloseIcon, MenuIcon } from "@/components/ui/Icons";
import { WalletMenu } from "@/components/wallet/WalletMenu";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/masters", label: "Masters" },
  { href: "/tournament", label: "Tournament" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/credits", label: "Credits" },
  { href: "/docs", label: "Docs" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [menuTop, setMenuTop] = useState(64);

  // Transparent at the top; glass with a bottom hairline after 8px of scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    // The menu opens right under the header, wherever it sits (a preview banner can push it down).
    setMenuTop(headerRef.current?.getBoundingClientRect().bottom ?? 64);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        ref={headerRef}
        style={{ viewTransitionName: "site-header" }}
        className={`sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] transition-[background-color,border-color,backdrop-filter] duration-300 ${
          scrolled || open ? "border-line bg-hay/70 backdrop-blur-xl" : "border-transparent bg-transparent"
        }`}
      >
        <div className="safe-x mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 sm:[--safe-pad:1.5rem]">
          <Link href="/" aria-label="Moofield home" className="flex h-11 shrink-0 items-center">
            <span className="flex items-center gap-2.5">
              <MooBotMascot variant="head" size={28} decorative />
              <span className="font-display text-lg font-semibold tracking-tight text-soil">Moofield</span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => {
                const active = isActive(pathname, n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={`nav-underline glint rounded-full px-3 py-2 text-sm font-medium no-underline transition-colors ${
                        active ? "text-grass" : "text-soil/80 hover:text-soil"
                      }`}
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="hidden lg:block">
            <WalletMenu />
          </div>

          <button
            type="button"
            className="-mr-2 grid h-11 w-11 place-items-center text-soil lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {/* Outside <header>: its backdrop-filter would make it the containing block and squash this fixed panel. */}
      {open && (
        <div
          id="mobile-menu"
          style={{ top: menuTop }}
          className="safe-x fixed inset-x-0 bottom-0 z-40 overflow-y-auto overscroll-contain bg-hay pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 lg:hidden"
        >
          <nav aria-label="Main">
            <ul className="space-y-1">
              {NAV.map((n) => {
                const active = isActive(pathname, n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={`block border-b border-line px-2 py-4 text-lg font-semibold no-underline ${active ? "text-grass" : "text-soil"}`}
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-6">
            <WalletMenu block />
          </div>
        </div>
      )}
    </>
  );
}
