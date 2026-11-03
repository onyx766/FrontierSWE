'use client';

import { useEffect, useRef } from 'react';
import { createRng } from '@/lib/rng';

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  speed: number;
  phase: number;
  color: string;
  /** Upward drift, px per second. */
  drift: number;
}

interface Glint {
  x: number;
  y: number;
  size: number;
  phase: number;
  spin: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

const WHITE = '255, 255, 255';
const LILAC = '214, 204, 255';
const PINK = '244, 196, 252';
/** Stars are specks; past 1.5x the extra pixels buy nothing. */
const MAX_DPR = 1.5;

/**
 * The night band's sky: a seeded field of twinkling stars drifting slowly
 * upward, a few rotating glints and the odd shooting star. Decorative
 * (aria-hidden). It draws one still frame under reduced motion, and the loop
 * only runs while the band is on screen and the tab is visible.
 */
export function ProjectsStarfield({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let glints: Glint[] = [];
    let meteor: Meteor | null = null;
    let nextMeteor = 2.5;
    let raf = 0;
    let last = 0;
    let clock = 0;
    let onScreen = false;
    const chance = createRng(0x51a7);

    // Seeded, so the same sky comes back after every resize.
    const build = () => {
      const rng = createRng(20261103);
      const count = Math.round(Math.min(220, Math.max(60, (width * height) / 6500)));
      stars = Array.from({ length: count }, () => {
        const tint = rng();
        return {
          x: rng(),
          y: rng(),
          r: 0.35 + rng() ** 2 * 1.15,
          alpha: 0.25 + rng() * 0.6,
          speed: 0.5 + rng() * 1.6,
          phase: rng() * Math.PI * 2,
          color: tint < 0.7 ? WHITE : tint < 0.9 ? LILAC : PINK,
          drift: 2 + rng() * 6,
        };
      });
      // Small and dim: they can land behind copy, so they must never compete with it.
      glints = Array.from({ length: 5 }, () => ({
        x: 0.04 + rng() * 0.92,
        y: 0.1 + rng() * 0.8,
        size: 2.5 + rng() * 2.5,
        phase: rng() * Math.PI * 2,
        spin: (rng() - 0.5) * 0.8,
      }));
    };

    const draw = (time: number, dt: number) => {
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;

      for (const star of stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(time * star.speed + star.phase);
        const y = (((star.y * height - time * star.drift) % height) + height) % height;
        ctx.globalAlpha = star.alpha * twinkle;
        ctx.fillStyle = `rgb(${star.color})`;
        ctx.beginPath();
        ctx.arc(star.x * width, y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Four-point glints, turning slowly as they pulse.
      for (const glint of glints) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 0.9 + glint.phase);
        const size = glint.size * (0.55 + 0.45 * pulse);
        ctx.save();
        ctx.translate(glint.x * width, glint.y * height);
        ctx.rotate(time * glint.spin + glint.phase);
        ctx.globalAlpha = 0.12 * pulse;
        ctx.fillStyle = `rgb(${LILAC})`;
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.2 + 0.45 * pulse;
        ctx.fillStyle = `rgb(${WHITE})`;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.quadraticCurveTo(0, 0, size, 0);
        ctx.quadraticCurveTo(0, 0, 0, size);
        ctx.quadraticCurveTo(0, 0, -size, 0);
        ctx.quadraticCurveTo(0, 0, 0, -size);
        ctx.fill();
        ctx.restore();
      }

      // Now and then, a shooting star falling away to the lower left.
      if (dt > 0 && !meteor && time > nextMeteor) {
        meteor = {
          x: (0.25 + chance() * 0.7) * width,
          y: chance() * height * 0.35,
          vx: -(240 + chance() * 160),
          vy: 110 + chance() * 80,
          age: 0,
          life: 0.9 + chance() * 0.5,
        };
        nextMeteor = time + 6 + chance() * 7;
      }
      if (meteor) {
        meteor.age += dt;
        const progress = meteor.age / meteor.life;
        if (progress >= 1) {
          meteor = null;
        } else {
          const headX = meteor.x + meteor.vx * meteor.age;
          const headY = meteor.y + meteor.vy * meteor.age;
          const tailX = headX - meteor.vx * 0.2;
          const tailY = headY - meteor.vy * 0.2;
          const gradient = ctx.createLinearGradient(headX, headY, tailX, tailY);
          gradient.addColorStop(0, `rgba(${WHITE}, ${(0.85 * Math.sin(Math.PI * progress)).toFixed(3)})`);
          gradient.addColorStop(1, `rgba(${LILAC}, 0)`);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(headX, headY);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      draw(clock, dt);
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const start = () => {
      if (raf || reduced.matches || !onScreen || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const still = () => {
      meteor = null;
      draw(clock, 0);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (!raf) still();
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotion = () => {
      if (reduced.matches) {
        stop();
        still();
      } else {
        start();
      }
    };

    resize();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }

    let intersection: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      intersection = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        onScreen = entry?.isIntersecting ?? false;
        if (onScreen) start();
        else stop();
      });
      intersection.observe(canvas);
    } else {
      onScreen = true;
      start();
    }

    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onMotion);

    return () => {
      stop();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      intersection?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotion);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
