import { MonoLabel } from '@/components/primitives/MonoLabel';
import { capabilityStrip } from '@/data/profile';

/**
 * A flat, scannable list of the stack. No logos, no skill bars — a founder
 * checking whether their stack is covered wants to find a word, fast.
 */
export function CapabilityStrip() {
  return (
    <section className="site-container py-16 md:py-20">
      <div className="hairline-top relative grid gap-6 pt-6 md:grid-cols-[13rem_1fr] md:gap-10">
        <span aria-hidden className="absolute top-0 left-0 h-px w-10 bg-accent" />
        <MonoLabel as="h2">Capabilities</MonoLabel>
        <ul className="flex flex-wrap gap-x-5 gap-y-3">
          {capabilityStrip.map((item) => (
            <li
              key={item}
              className="font-mono text-xs tracking-[0.08em] text-body transition-colors hover:text-primary"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
