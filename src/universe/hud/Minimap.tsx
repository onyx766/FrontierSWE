'use client';

import { useEffect, useMemo, useRef } from 'react';
import { hudCopy, islands } from '@/data/universe';
import { runtime } from '../state/runtime';
import { useUniverse } from '../state/store';
import { islandCenter, WORLD } from '../world/network';
import type { StationAnchor } from '../world/stations';
import { world } from '../world/world';
import { ACCENT_HEX, ROAD_STROKE } from './colors';
import { MAP_RADIUS, mapPercent, polylinePath, roadPaths } from './mapGeometry';

const VIEW_BOX = `${-MAP_RADIUS} ${-MAP_RADIUS} ${MAP_RADIUS * 2} ${MAP_RADIUS * 2}`;
const DEGREES = 180 / Math.PI;

/** The walk to `target` as it stands when the walk begins. */
function useRoutePath(target: string | null): string | null {
  return useMemo(() => {
    if (!target) return null;
    try {
      return polylinePath(world.routeTo(runtime.robot, target).points);
    } catch {
      return null;
    }
  }, [target]);
}

function MapStation({ station }: { station: StationAnchor }) {
  const visited = useUniverse((state) => state.visited.includes(station.id));
  const heading = useUniverse((state) => state.travel === station.id);
  const here = useUniverse((state) => state.near === station.id);
  const { left, top } = mapPercent(station.pad);

  return (
    /* The mission log is the keyboard route to every station, so these stay out of the tab order. */
    <button
      type="button"
      tabIndex={-1}
      className="uh-map-stop"
      data-state={here ? 'here' : heading ? 'heading' : visited ? 'visited' : 'new'}
      data-align={left > 62 ? 'end' : left < 38 ? 'start' : 'center'}
      style={{ left: `${left}%`, top: `${top}%` }}
      aria-label={`${hudCopy.map.travel} ${station.title}`}
      onClick={() => useUniverse.getState().travelTo(station.id)}
    >
      <span className="uh-map-stop-label" aria-hidden>
        {station.title}
      </span>
    </button>
  );
}

/**
 * The road network from above. The roads are static; the robot is a separate
 * little SVG moved by a compositor transform from its own animation frame loop,
 * so following it costs neither a React render nor a repaint of the map.
 */
export function Minimap({ live }: { live: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const marker = useRef<SVGSVGElement>(null);
  const roads = useMemo(() => roadPaths(world.network), []);
  const travel = useUniverse((state) => state.travel);
  const route = useRoutePath(travel);

  useEffect(() => {
    if (!live) return;
    let frame = 0;
    let lastX = NaN;
    let lastZ = NaN;
    let lastYaw = NaN;

    const follow = () => {
      frame = requestAnimationFrame(follow);
      const { x, z, yaw } = runtime.robot;
      if (x === lastX && z === lastZ && yaw === lastYaw) return;
      lastX = x;
      lastZ = z;
      lastYaw = yaw;

      const size = box.current?.clientWidth ?? 0;
      const { left, top } = mapPercent(runtime.robot);
      if (marker.current) {
        /* Yaw 0 faces +Z, down the map, which is how the marker is drawn. */
        marker.current.style.transform = `translate3d(${(left / 100) * size}px, ${(top / 100) * size}px, 0) rotate(${-yaw * DEGREES}deg)`;
      }
    };

    follow();
    return () => cancelAnimationFrame(frame);
  }, [live]);

  return (
    <div className="uh-map uh-glass" role="group" aria-label={hudCopy.map.label}>
      <div ref={box} className="uh-map-box">
        <svg viewBox={VIEW_BOX} className="absolute inset-0 size-full" aria-hidden>
          <circle r={WORLD.ringRadius + 8} fill="none" stroke="#7fb0ff" strokeOpacity="0.07" />
          {islands.map((island) => {
            const center = islandCenter(island);
            return (
              <circle
                key={island.id}
                cx={center.x}
                cy={center.z}
                r={WORLD.islandRadius}
                fill={ACCENT_HEX[island.accent]}
                fillOpacity="0.1"
                stroke={ACCENT_HEX[island.accent]}
                strokeOpacity="0.4"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {roads.map((road) => (
              <path
                key={road.style}
                d={road.d}
                stroke={ROAD_STROKE[road.style].color}
                strokeWidth={ROAD_STROKE[road.style].width}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {route ? (
              <path
                d={route}
                stroke="#ffd29c"
                strokeWidth="2.4"
                strokeDasharray="1 4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>

          <path d="M0 -6.5 4.6 0 0 6.5 -4.6 0Z" fill="#b69cff" fillOpacity="0.9" />
        </svg>

        {world.stations.map((station) => (
          <MapStation key={station.id} station={station} />
        ))}

        <svg ref={marker} viewBox="-10 -10 20 20" className="uh-map-robot" aria-hidden>
          <circle r="9" fill="#58d8ff" fillOpacity="0.2" />
          <path d="M0 8 5.4 -5 0 -2.6 -5.4 -5Z" fill="#eaf8ff" stroke="#58d8ff" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
