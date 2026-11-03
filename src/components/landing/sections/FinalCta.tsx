import Link from 'next/link';
import { IslandCanvas } from '@/components/landing/hero/IslandCanvas';
import { Icon } from '@/components/landing/primitives/Icon';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { RevealGroup } from '@/components/primitives/Reveal';
import { finalCta } from '@/data/landing';
import { cn } from '@/lib/utils';
import styles from './FinalCta.module.css';
import { FinalCtaStage } from './FinalCtaStage';
import pano from './Panorama.module.css';
import { PanoramaBackdrop, PanoramaFront, parallaxDepth } from './PanoramaBackdrop';

const TITLE_ID = 'explore-title';

/** The light-streak underline beneath "Now Explore It.", drawn on reveal. */
function Swash() {
  return (
    <svg viewBox="0 0 320 26" aria-hidden focusable="false" className={styles.swash}>
      <defs>
        <linearGradient id="fc-swash" x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c4a5ff" stopOpacity="0" />
          <stop offset="0.14" stopColor="#a477ff" />
          <stop offset="0.62" stopColor="#d2b0ff" />
          <stop offset="1" stopColor="#ffd1f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M4 17C70 8 170 4 316 10"
        pathLength={1}
        fill="none"
        stroke="url(#fc-swash)"
        strokeWidth={4.5}
        strokeLinecap="round"
        className={styles.swashPath}
      />
    </svg>
  );
}

/**
 * The closing band: a pastel sunset over a sea of cloud, the island city
 * floating on the right and the invitation into the 3D world on the left.
 * The scene is decoration (aria-hidden); the heading, copy and links are plain
 * server-rendered HTML, readable without JavaScript. A dusk-violet scrim sits
 * behind the copy so white text keeps its contrast over the pastel sky.
 */
export function FinalCta() {
  const [lead = '', accent = ''] = finalCta.lines;

  return (
    <FinalCtaStage id="explore" labelledBy={TITLE_ID} className={styles.band}>
      <PanoramaBackdrop />

      <div className={cn('lp-container', styles.content)}>
        <RevealGroup className={styles.copy}>
          <h2 id={TITLE_ID} className={cn('lp-italic', styles.title)}>
            <span className={styles.line}>{lead}</span>{' '}
            <span className={styles.accent}>
              {accent}
              <Swash />
            </span>
          </h2>
          <p className={styles.description}>{finalCta.description}</p>
          <div className={styles.actions}>
            <span className={styles.ctaGlow}>
              <LpButton
                href={finalCta.cta.href}
                variant="gradient"
                size="lg"
                icon="arrow-up-right"
                magnetic
                className={styles.cta}
              >
                {finalCta.cta.label}
              </LpButton>
            </span>
            <Link href={finalCta.secondary.href} className={styles.secondary}>
              <span className={styles.secondaryLabel}>{finalCta.secondary.label}</span>
              <Icon name="arrow-right" strokeWidth={2} className={styles.secondaryIcon} />
            </Link>
          </div>
        </RevealGroup>
      </div>

      {/* The island city (it bobs and fades in on its own). Its base sinks into
          the cloud bank drawn in front of it. */}
      <div aria-hidden className={cn(pano.parallax, styles.islandBox)} style={parallaxDepth(12, 18)}>
        <div className={styles.islandHalo} />
        <div className={styles.islandLift}>
          <IslandCanvas variant="panorama" />
          <Link href={finalCta.cta.href} tabIndex={-1} prefetch={false} className={styles.islandHit} />
        </div>
      </div>

      <PanoramaFront />
      <div aria-hidden className={styles.scrim} />
    </FinalCtaStage>
  );
}
