'use client';

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import { FlowEdge, FlowFork } from './FlowEdges';
import styles from './HowIEngineer.module.css';

export interface FlowNodeView {
  id: string;
  label: string;
  caption: string;
  detail: string;
  /** Rendered on the server and passed in, so no icon set ships in this bundle. */
  icon: ReactNode;
}

interface FlowDiagramProps {
  /** The request path, in order. */
  path: FlowNodeView[];
  /** The two stores the last layer fans out to. */
  stores: FlowNodeView[];
  /** One sentence for screen readers saying what the arrows say. */
  summary: string;
}

/*
 * Seconds into each 6.4s request (`--cycle` in the module). The keyframes'
 * travel windows are these durations as fractions of the cycle, so the CSS
 * changes with them.
 */
const HOP = 0.84; // a straight hop: 0.72s of travel, then a beat at the node
const TRAVEL = 0.72;
const STUB = 0.4;
const BRANCH = 0.9;

const at = (seconds: number) => `${seconds.toFixed(2)}s`;
const noSubscription = () => () => {};
const pad = (value: number) => String(value).padStart(2, '0');
/** "(Frontend)" reads as "Frontend" after a separator in the detail bar. */
const bare = (caption: string) => caption.replace(/^\((.*)\)$/, '$1');

/**
 * The request path as a WAI-ARIA tablist: each layer is a tab and the detail
 * bar is its panel. Hover, focus, click or the arrow keys select a layer; the
 * choice sticks, so the pointer can leave to read it. Packets are CSS
 * animations that pause while the panel is off screen or when asked to.
 */
export function FlowDiagram({ path, stores, summary }: FlowDiagramProps) {
  const uid = useId();
  const pair = stores.slice(0, 2);
  const nodes = [...path, ...pair];
  const [activeId, setActiveId] = useState(() => nodes[0]?.id ?? '');
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  // False in the server HTML and during hydration, true after: the controls
  // that need JavaScript keep their space but stay hidden until it runs.
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setOffscreen(!entry.isIntersecting);
      },
      { rootMargin: '120px 0px' },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const activeIndex = Math.max(
    0,
    nodes.findIndex((node) => node.id === activeId),
  );
  const active = nodes[activeIndex];
  if (!active) return null;

  const tabId = (id: string) => `${uid}-tab-${id}`;
  const panelId = `${uid}-panel`;
  const labelId = `${uid}-label`;
  const summaryId = `${uid}-summary`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = nodes.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = index === 0 ? last : index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = nodes[next];
    if (!target) return;
    setActiveId(target.id);
    tabRefs.current[next]?.focus();
  };

  // The timeline of one request: when each node is reached.
  const hubIndex = path.length - 1;
  const forkAt = hubIndex * HOP;
  const branchAt = forkAt + STUB;
  const arrival = (index: number) => {
    if (index === 0) return 0;
    if (index <= hubIndex) return (index - 1) * HOP + TRAVEL;
    return branchAt + BRANCH;
  };

  const hubId = path[hubIndex]?.id;
  const [storeA, storeB] = pair;
  const touches = (...ids: (string | undefined)[]) => ids.includes(activeId);

  const renderNode = (node: FlowNodeView, index: number, placement?: string) => {
    const selected = index === activeIndex;
    return (
      <button
        key={node.id}
        ref={(element) => {
          tabRefs.current[index] = element;
        }}
        type="button"
        role="tab"
        id={tabId(node.id)}
        aria-selected={selected}
        aria-controls={panelId}
        tabIndex={selected ? 0 : -1}
        className={cn(styles.node, index > hubIndex ? styles.storeNode : styles.pathNode, placement)}
        style={{ '--arrive': at(arrival(index)) } as CSSProperties}
        onPointerEnter={() => setActiveId(node.id)}
        onFocus={() => setActiveId(node.id)}
        onClick={() => setActiveId(node.id)}
        onKeyDown={(event) => onKeyDown(event, index)}
      >
        <span aria-hidden data-motion="packet" className={styles.ping} />
        <span aria-hidden className={styles.glyph}>
          <span className={styles.spin}>{node.icon}</span>
        </span>
        <span className={styles.text}>
          <span className={styles.label}>{node.label}</span>
          <span className={styles.caption}>{node.caption}</span>
        </span>
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        styles.panel,
        'rounded-[1.5rem] border border-dashed border-[#d0c8e8] bg-white/65 p-4 shadow-lp-sm sm:p-5 lg:p-4 xl:p-6',
      )}
      data-paused={paused ? '' : undefined}
      data-offscreen={offscreen ? '' : undefined}
      data-ready={hydrated ? '' : undefined}
    >
      <div className={styles.head}>
        <p id={labelId} className={styles.headLabel}>
          <span aria-hidden className={styles.live} />
          Request path
        </p>
        <div className={styles.headEnd}>
          <p aria-hidden className={styles.hint}>
            <span className={styles.hintFine}>Hover a layer</span>
            <span className={styles.hintCoarse}>Tap a layer</span>
          </p>
          <button
            type="button"
            className={styles.toggle}
            aria-label={paused ? 'Play the request animation' : 'Pause the request animation'}
            onClick={() => setPaused((value) => !value)}
          >
            <svg viewBox="0 0 16 16" aria-hidden focusable="false" className={styles.toggleIcon}>
              {paused ? (
                <path d="M5 3.4v9.2l7.2-4.6Z" fill="currentColor" />
              ) : (
                <path
                  d="M5.6 3.8v8.4M10.4 3.8v8.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              )}
            </svg>
            <span aria-hidden>{paused ? 'Play' : 'Pause'}</span>
          </button>
        </div>
      </div>

      <p id={summaryId} className="sr-only">
        {summary}
      </p>

      <div role="tablist" aria-labelledby={labelId} aria-describedby={summaryId} className={styles.flow}>
        {path.map((node, index) => {
          const next = path[index + 1];
          return (
            <Fragment key={node.id}>
              {renderNode(node, index)}
              {next ? <FlowEdge hot={touches(node.id, next.id)} delay={at(index * HOP)} /> : null}
            </Fragment>
          );
        })}
        <FlowFork
          stubHot={touches(hubId, storeA?.id, storeB?.id)}
          branchHot={[touches(hubId, storeA?.id), touches(hubId, storeB?.id)]}
          stubDelay={at(forkAt)}
          branchDelay={at(branchAt)}
        />
        {storeA ? renderNode(storeA, hubIndex + 1, styles.storeA) : null}
        {storeB ? renderNode(storeB, hubIndex + 2, styles.storeB) : null}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(active.id)}
        aria-live="polite"
        tabIndex={0}
        className={styles.detail}
      >
        <span aria-hidden className={styles.detailGlyph}>
          <span key={active.id} className={styles.detailGlyphInner}>
            {active.icon}
          </span>
        </span>
        <div className={styles.detailStack}>
          {nodes.map((node) => (
            <div key={node.id} aria-hidden className={styles.detailSizer}>
              <DetailCopy node={node} />
            </div>
          ))}
          <div key={`live-${active.id}`} className={styles.detailBody}>
            <DetailCopy node={active} />
          </div>
        </div>
        <span aria-hidden className={styles.detailIndex}>
          {pad(activeIndex + 1)} / {pad(nodes.length)}
        </span>
      </div>
    </div>
  );
}

function DetailCopy({ node }: { node: FlowNodeView }) {
  return (
    <>
      <p className={styles.detailTitle}>
        {node.label}
        <span className={styles.detailCaption}> · {bare(node.caption)}</span>
      </p>
      <p className={styles.detailText}>{node.detail}</p>
    </>
  );
}
