"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import ThemeToggle from "@/src/components/ThemeToggle";

const githubUrl = "https://github.com/BayuDivaA/nalar-protocol";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="site-header-inner">
        <Link href="/" className="site-brand" onClick={close}>
          <span className="site-brand-mark" aria-hidden="true">N</span>
          <span>Nalar Protocol</span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          <a href="#mechanism">Mechanism</a>
          <a href="#evidence">Evidence</a>
          <Link href="/demo">Demo</Link>
          <Link href="/install" className="site-nav-strong">Get the extension</Link>
          <ThemeToggle />
        </nav>

        <div className="site-mobile-actions">
          <ThemeToggle />
          <button
            type="button"
            className="menu-button"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className={open ? "menu-line menu-line-top open" : "menu-line menu-line-top"} />
            <span className={open ? "menu-line menu-line-bottom open" : "menu-line menu-line-bottom"} />
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
          <a href="#mechanism" onClick={close}>Mechanism</a>
          <a href="#evidence" onClick={close}>Evidence</a>
          <Link href="/demo" onClick={close}>Demo</Link>
          <Link href="/install" onClick={close}>Get the extension</Link>
          <a href={githubUrl} target="_blank" rel="noreferrer" onClick={close}>View source on GitHub</a>
        </nav>
      )}
    </header>
  );
}

export { githubUrl };
