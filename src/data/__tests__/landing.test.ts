import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  architectureIntro,
  experienceIntro,
  finalCta,
  footer,
  hero,
  landingProjects,
  landingServices,
  navSections,
  projectsIntro,
  quickTasks,
  servicesIntro,
  skillTabs,
  socialLinks,
  about,
  startProjectHref,
} from '@/data/landing';
import { getProject } from '@/data/projects';
import { WORLD_AT_PARAM, WORLD_PATH } from '@/data/universe';

/**
 * The site is one page plus the 3D world. Every homepage link is therefore an
 * in-page anchor, the world, mail, or an off-site profile — and every anchor
 * must name a section that is actually rendered.
 */

const SECTIONS_DIR = join(process.cwd(), 'src/components/landing');

/** Every `id="…"` declared in the landing components: the anchors that exist. */
function renderedIds(dir: string): Set<string> {
  const ids = new Set<string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const id of renderedIds(path)) ids.add(id);
    } else if (entry.name.endsWith('.tsx')) {
      for (const match of readFileSync(path, 'utf8').matchAll(/\bid="([a-z-]+)"/g)) {
        if (match[1]) ids.add(match[1]);
      }
    }
  }
  return ids;
}

const ANCHORS = renderedIds(SECTIONS_DIR);

function checkHref(href: string): string | null {
  if (href.startsWith('mailto:') || href.startsWith('https://')) return null;
  if (href.startsWith('#')) return ANCHORS.has(href.slice(1)) ? null : `no section with id ${href}`;
  const [path = '', query = ''] = href.split('?');
  if (path !== WORLD_PATH) return `links off the page to ${href}`;
  if (query && !query.startsWith(`${WORLD_AT_PARAM}=`)) return `unexpected world query ${href}`;
  return null;
}

describe('landing data', () => {
  it('resolves every featured project slide to a real project', () => {
    expect(landingProjects).toHaveLength(3);
    for (const project of landingProjects) {
      expect(getProject(project.slug)).toBeDefined();
      expect(project.tags.length).toBeGreaterThan(0);
    }
  });

  it('gives every nav section a rendered anchor', () => {
    for (const section of navSections) expect(ANCHORS).toContain(section.id);
    expect(ANCHORS).toContain('contact');
  });

  it('links only to in-page sections, the 3D world, mail and profiles', () => {
    const hrefs = [
      startProjectHref,
      hero.primaryCta.href,
      hero.secondaryCta.href,
      hero.worldCta.href,
      projectsIntro.allProjects.href,
      experienceIntro.more.href,
      architectureIntro.more.href,
      servicesIntro.more.href,
      quickTasks.more.href,
      about.secondaryCta.href,
      finalCta.cta.href,
      finalCta.secondary.href,
      ...landingProjects.map((project) => project.href),
      ...landingServices.map((service) => service.href),
      ...footer.columns.flatMap((column) => column.items.map((item) => item.href)),
      ...socialLinks.map((link) => link.href),
    ];
    const problems = hrefs.map(checkHref).filter((problem): problem is string => problem !== null);
    expect(problems).toEqual([]);
  });

  it('gives every skill tab a unique id and a full row of tools', () => {
    const ids = skillTabs.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tab of skillTabs) expect(tab.tools).toHaveLength(6);
  });

  it('features exactly one service, as the design does', () => {
    expect(landingServices.filter((service) => service.featured)).toHaveLength(1);
  });
});
