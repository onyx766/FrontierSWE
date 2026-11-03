import { cn } from '@/lib/utils';
import styles from './HowIEngineer.module.css';

/*
 * The diagram's connectors. Each draws both orientations: rightward when the
 * flow is a row, downward when it stacks; the module's container query shows
 * one. Coordinates are percentages of the edge's box, so nothing is measured.
 */

/** Open chevrons whose tips sit exactly on the end of their line. */
const ARROW_RIGHT = 'M-6.5 -4.25 L0 0 L-6.5 4.25';
const ARROW_DOWN = 'M-4.25 -6.5 L0 0 L4.25 -6.5';

const hotAttr = (hot: boolean) => (hot ? '' : undefined);

/** A glowing packet crossing `rail` (a box) corner to corner, once per cycle. */
function Packet({ rail, motion, delay }: { rail?: string; motion?: string; delay: string }) {
  return (
    <span aria-hidden data-motion="packet" className={cn(styles.rail, rail)}>
      <span className={cn(styles.mover, motion)} style={{ animationDelay: delay }}>
        <span className={styles.packet} />
      </span>
    </span>
  );
}

/** A straight hop between two layers of the path. */
export function FlowEdge({ hot, delay }: { hot: boolean; delay: string }) {
  return (
    <span aria-hidden className={styles.edge} data-hot={hotAttr(hot)}>
      <span className={styles.edgeBox}>
        <svg className={styles.lines} focusable="false">
          <g className={styles.wide}>
            <line x1="0" y1="50%" x2="100%" y2="50%" />
            <svg x="100%" y="50%" overflow="visible">
              <path d={ARROW_RIGHT} />
            </svg>
          </g>
          <g className={styles.narrow}>
            <line x1="50%" y1="0" x2="50%" y2="100%" />
            <svg x="50%" y="100%" overflow="visible">
              <path d={ARROW_DOWN} />
            </svg>
          </g>
        </svg>
        <Packet rail={styles.straight} motion={styles.travel} delay={delay} />
      </span>
    </span>
  );
}

interface FlowForkProps {
  /** The stub from the last layer to the junction. */
  stubHot: boolean;
  /** The branches to the first and second store. */
  branchHot: [boolean, boolean];
  stubDelay: string;
  branchDelay: string;
}

/**
 * The bracket where the last layer fans out to the two stores: right then up
 * and down to the stacked stores in a row; down then out to the side-by-side
 * stores when stacked. One packet runs the stub and splits at the junction.
 */
export function FlowFork({ stubHot, branchHot, stubDelay, branchDelay }: FlowForkProps) {
  const [hotA, hotB] = branchHot;
  return (
    <span aria-hidden className={styles.fork}>
      <span className={styles.edgeBox}>
        <svg className={styles.lines} focusable="false">
          <g className={styles.wide}>
            <line data-hot={hotAttr(stubHot)} x1="0" y1="50%" x2="50%" y2="50%" />
            <g data-hot={hotAttr(hotA)}>
              <line x1="50%" y1="50%" x2="50%" y2="25%" />
              <line x1="50%" y1="25%" x2="100%" y2="25%" />
              <svg x="100%" y="25%" overflow="visible">
                <path d={ARROW_RIGHT} />
              </svg>
            </g>
            <g data-hot={hotAttr(hotB)}>
              <line x1="50%" y1="50%" x2="50%" y2="75%" />
              <line x1="50%" y1="75%" x2="100%" y2="75%" />
              <svg x="100%" y="75%" overflow="visible">
                <path d={ARROW_RIGHT} />
              </svg>
            </g>
            <circle className={styles.junction} data-hot={hotAttr(stubHot)} cx="50%" cy="50%" r="3" />
          </g>
          <g className={styles.narrow}>
            <line data-hot={hotAttr(stubHot)} x1="50%" y1="0" x2="50%" y2="50%" />
            <g data-hot={hotAttr(hotA)}>
              <line x1="50%" y1="50%" x2="25%" y2="50%" />
              <line x1="25%" y1="50%" x2="25%" y2="100%" />
              <svg x="25%" y="100%" overflow="visible">
                <path d={ARROW_DOWN} />
              </svg>
            </g>
            <g data-hot={hotAttr(hotB)}>
              <line x1="50%" y1="50%" x2="75%" y2="50%" />
              <line x1="75%" y1="50%" x2="75%" y2="100%" />
              <svg x="75%" y="100%" overflow="visible">
                <path d={ARROW_DOWN} />
              </svg>
            </g>
            <circle className={styles.junction} data-hot={hotAttr(stubHot)} cx="50%" cy="50%" r="3" />
          </g>
        </svg>
        <Packet rail={cn(styles.railWide, styles.forkStub)} motion={styles.stub} delay={stubDelay} />
        <Packet rail={cn(styles.railWide, styles.forkUp)} motion={styles.up} delay={branchDelay} />
        <Packet rail={cn(styles.railWide, styles.forkDown)} motion={styles.down} delay={branchDelay} />
        <Packet rail={cn(styles.railNarrow, styles.forkStubNarrow)} motion={styles.stub} delay={stubDelay} />
        <Packet rail={cn(styles.railNarrow, styles.forkLeft)} motion={styles.left} delay={branchDelay} />
        <Packet rail={cn(styles.railNarrow, styles.forkRight)} motion={styles.right} delay={branchDelay} />
      </span>
    </span>
  );
}
