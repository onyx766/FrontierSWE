'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ActionLink } from '@/components/primitives/Button';
import { MonoLabel } from '@/components/primitives/MonoLabel';
import { StatusDot } from '@/components/primitives/StatusDot';
import { profile } from '@/data/profile';
import { navItems } from '@/data/site';
import { cn } from '@/lib/utils';

/**
 * Minimal navigation. Text links are always present, so the topology is an
 * enhancement rather than the only way to move around the site. The
 * availability indicator and the primary CTA are both permanently visible —
 * the two things a visiting founder needs to act on.
 */
export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile sheet on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled || open
          ? 'border-line bg-void/90 backdrop-blur-md'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="site-container flex h-16 items-center justify-between gap-6 md:h-18">
        <Link href="/" className="group flex items-center gap-2.5 whitespace-nowrap">
          <span className="text-sm font-medium tracking-tight text-primary">
            {profile.name}
          </span>
          <span aria-hidden className="text-muted">
            //
          </span>
          <MonoLabel size="sm" className="transition-colors group-hover:text-body">
            Engineering Universe
          </MonoLabel>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'label-mono transition-colors hover:text-primary',
                isActive(item.href) && 'text-primary',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 md:gap-6">
          <span className="hidden items-center gap-2 md:flex">
            <StatusDot state={profile.availability.state} />
            <MonoLabel size="sm" tone="accent">
              Available
            </MonoLabel>
          </span>

          <ActionLink href="/start-project" variant="primary" size="sm" className="hidden sm:inline-flex">
            Start project
          </ActionLink>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-9 w-9 items-center justify-center border border-line text-muted transition-colors hover:border-line-strong hover:text-primary lg:hidden"
          >
            <span aria-hidden className="relative block h-3 w-4">
              <span
                className={cn(
                  'absolute left-0 h-px w-full bg-current transition-all duration-300',
                  open ? 'top-1.5 rotate-45' : 'top-0.5',
                )}
              />
              <span
                className={cn(
                  'absolute left-0 h-px w-full bg-current transition-all duration-300',
                  open ? 'top-1.5 -rotate-45' : 'top-2.5',
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-line bg-void/95 backdrop-blur-md lg:hidden"
      >
        <nav aria-label="Mobile" className="site-container flex flex-col py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'border-b border-line-faint py-4 text-sm transition-colors last:border-0',
                isActive(item.href) ? 'text-accent' : 'text-body hover:text-primary',
              )}
            >
              {item.label}
            </Link>
          ))}
          <div className="flex items-center justify-between gap-4 py-4">
            <span className="flex items-center gap-2">
              <StatusDot state={profile.availability.state} />
              <MonoLabel size="sm" tone="accent">
                Available for projects
              </MonoLabel>
            </span>
            <ActionLink href="/start-project" variant="primary" size="sm">
              Start project
            </ActionLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
