/**
 * Fixed engineering grid plus a radial vignette. Purely decorative, so it is
 * aria-hidden and sits behind everything at low opacity. Fixed rather than
 * scrolling, which keeps it reading as a backdrop and avoids repaint on scroll.
 */
export function GridBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="grid-backdrop absolute inset-0 opacity-[0.55]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 0%, transparent 0%, var(--color-void) 72%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[42rem]"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% -10%, rgba(61,214,140,0.05) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}
