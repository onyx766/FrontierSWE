import type { CSSProperties } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import type { LandingService } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './ServicesOrbit.module.css';

/**
 * Decoration for the Services heading column: the services as satellites
 * circling one core. Hovering or focusing a service card lights up its
 * satellite and pauses the orbit — those rules live in Services.module.css,
 * keyed on the `data-svc-sat` / `data-orbit-spin` attributes set here.
 */
export function ServicesOrbit({
  services,
  className,
}: {
  services: LandingService[];
  className?: string;
}) {
  const step = 360 / Math.max(1, services.length);

  return (
    <div aria-hidden className={cn(styles.orbit, className)}>
      <span className={styles.glow} />
      <span className={styles.ringOuter} />
      <span className={styles.ringInner} />
      <span className={styles.core}>
        <Icon name="sparkles" className="size-6" />
      </span>
      <span data-orbit-spin="" className={styles.track}>
        {services.map((service, index) => (
          <span
            key={service.id}
            className={styles.sat}
            style={{ '--angle': `${index * step}deg` } as CSSProperties}
          >
            <span data-orbit-spin="" data-svc-sat={index} className={styles.bubble}>
              <Icon name={service.icon} className="size-4" />
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}
