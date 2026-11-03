import type { ProjectVisualKind } from '@/data/landing';
import { cn } from '@/lib/utils';
import { agentsArt } from './ProjectArtAgents';
import { SparkleGlyph, vars, type PanelArt } from './ProjectArtKit';
import { ragArt } from './ProjectArtRag';
import { saasArt } from './ProjectArtSaas';
import styles from './Projects.module.css';

const ART: Record<ProjectVisualKind, () => PanelArt> = {
  agents: agentsArt,
  rag: ragArt,
  saas: saasArt,
};

/** Glints around the panels: [left %, top %, size px, delay s]. */
const SPARKLES: [number, number, number, number][] = [
  [3, 10, 9, 0],
  [60, 0, 7, -1.6],
  [94, 6, 11, -3.1],
  [88, 84, 8, -2.2],
  [24, 86, 6, -0.8],
];

/**
 * A project's illustration: three translucent glass panels standing in 3D
 * (turned about -18deg, tipped back 8deg), floating, leaning toward the
 * pointer (the carousel writes --tilt-x/--tilt-y on the card) and dealt in
 * with a swing when their slide enters. Pure SVG and CSS, server-rendered,
 * and decorative: the slide's text carries the content.
 */
export function ProjectVisual({ kind }: { kind: ProjectVisualKind }) {
  const art = ART[kind]();
  return (
    <div className={styles.visual} aria-hidden="true">
      <div className={styles.floor} />
      <div className={styles.streak} />
      <div className={styles.float}>
        <div className={styles.scene}>
          <div className={cn(styles.panelWrap, styles.posBack)}>
            <div className={styles.panel}>{art.back}</div>
          </div>
          <div className={cn(styles.panelWrap, styles.posMain)}>
            <div className={cn(styles.panel, styles.panelMain, kind === 'agents' && styles.dots)}>
              {art.main}
            </div>
          </div>
          <div className={cn(styles.panelWrap, styles.posSide)}>
            <div className={styles.panel}>{art.side}</div>
          </div>
        </div>
      </div>
      {SPARKLES.map(([left, top, size, delay]) => (
        <span
          key={`${left}-${top}`}
          className={styles.sparkle}
          style={vars({ left: `${left}%`, top: `${top}%`, '--s': `${size}px`, '--delay': `${delay}s` })}
        >
          <SparkleGlyph />
        </span>
      ))}
    </div>
  );
}
