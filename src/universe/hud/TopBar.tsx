'use client';

import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { profile } from '@/data/profile';
import { navItems, SITE_NAME } from '@/data/site';
import { hudCopy } from '@/data/universe';
import { useUniverse } from '../state/store';
import { BrandMark } from './BrandMark';
import { ArrowUpRightIcon, CloseIcon, MenuIcon } from './icons';

const [BRAND_NAME = '', BRAND_TITLE = ''] = SITE_NAME.split(' // ');

function Availability() {
  const { state, label } = profile.availability;
  return (
    <span className="uh-available" data-state={state} title={label}>
      <span className="uh-available-dot" aria-hidden />
      <span className="sr-only">{label}</span>
      <span aria-hidden>{hudCopy.availability[state]}</span>
    </span>
  );
}

function StartProject() {
  return (
    <Link href="/start-project" className="uh-cta">
      {hudCopy.cta}
      <ArrowUpRightIcon className="uh-cta-arrow" />
    </Link>
  );
}

/** The bar is the one piece of the HUD that stays on screen in every view. */
export function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    /* Captured and stopped, so this Esc closes the menu and does not reach the world. */
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [menuOpen]);

  /* On the homepage already, so the logo means "back to the opening shot". */
  const onBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const { phase, overview } = useUniverse.getState();
    if (phase === 'explore') {
      event.preventDefault();
      overview();
    }
  };

  return (
    <header className="uh-bar">
      <Link href="/" className="uh-brand" aria-label={SITE_NAME} onClick={onBrandClick}>
        <BrandMark />
        <span className="uh-brand-text" aria-hidden>
          <span className="uh-brand-name">{BRAND_NAME}</span>
          {' // '}
          {BRAND_TITLE}
        </span>
      </Link>

      <div className="uh-bar-right">
        <nav aria-label="Main" className="uh-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="uh-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <Availability />
        <StartProject />

        <button
          type="button"
          className="uh-menu-button"
          aria-expanded={menuOpen}
          aria-controls="uh-menu"
          aria-label={menuOpen ? hudCopy.menu.close : hudCopy.menu.open}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <CloseIcon className="size-4.5" /> : <MenuIcon className="size-4.5" />}
        </button>
      </div>

      <div id="uh-menu" className="uh-menu uh-glass" hidden={!menuOpen}>
        <nav aria-label="Menu" className="flex flex-col">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b border-white/8 py-3 text-[15px] text-[#e6e9f0] last:border-0"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-2 flex items-center justify-between gap-3">
          <Availability />
          <StartProject />
        </div>
      </div>
    </header>
  );
}
