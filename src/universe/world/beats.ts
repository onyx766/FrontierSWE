import { domains } from '@/data/domains';
import { experience, principles, stackGroups } from '@/data/experience';
import { profile } from '@/data/profile';
import { archiveProjects, type LandingProject } from '@/data/landing';
import { services, smallTasks } from '@/data/services';
import type { StationContent } from '@/data/universe';
import type { ArchitectureSpec, CaseStudyMetric } from '@/lib/types';
import { domainHref, sectionHref } from '@/data/site';

/**
 * What the robot says at each station.
 *
 * Every word comes from the existing data files, so the 3D world cannot drift
 * from the case-study pages. Only the section labels are written here. A
 * station is a short sequence of beats; the visitor pages through them while
 * the robot talks, and the last beat links to the full page.
 */

export interface BeatItem {
  title: string;
  body: string;
}

export interface BeatLink {
  label: string;
  href: string;
}

export interface Beat {
  id: string;
  /** Mono section label, e.g. "The problem". */
  kicker: string;
  title: string;
  body?: string;
  bullets?: string[];
  items?: BeatItem[];
  chips?: string[];
  metrics?: CaseStudyMetric[];
  architecture?: ArchitectureSpec;
  link?: BeatLink;
  /** Plain-text version for the speech bubble and the optional voice. */
  speech: string;
}

export interface Briefing {
  stationId: string;
  title: string;
  /** Mono line above the title. */
  eyebrow: string;
  /** True when this is placeholder content, which must show a visible chip. */
  placeholder: boolean;
  beats: Beat[];
}

/** Removes `[PLACEHOLDER …]` notes. For speech only; the panel keeps them visible. */
export function stripPlaceholderNotes(text: string): string {
  return text
    .replace(/\[PLACEHOLDER[^\]]*\]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** First sentences of `text`, up to about `limit` characters. */
export function firstSentences(text: string, limit = 200): string {
  const clean = stripPlaceholderNotes(text);
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  let out = '';
  for (const sentence of sentences) {
    if (out && out.length + sentence.length > limit) break;
    out += sentence;
  }
  return out.trim();
}

/** A project's stop: the same words as its section in the homepage archive. */
function projectBriefing(station: StationContent, project: LandingProject): Briefing {
  const points = project.engineering ?? project.capabilities ?? [];
  const beats: Beat[] = [
    {
      id: 'overview',
      kicker: project.category,
      title: project.tagline,
      body: project.summary,
      ...(project.stack.length ? { chips: project.stack } : {}),
      speech: firstSentences(project.summary),
    },
    {
      id: 'role',
      kicker: 'My role',
      title: project.openSource ? 'My contribution, not the product' : 'What I did',
      body: project.openSource
        ? `${project.contribution} ${project.name} itself is a community-maintained open-source product.`
        : project.contribution,
      speech: project.contribution,
    },
  ];
  if (project.architecture) {
    beats.push({
      id: 'architecture',
      kicker: 'Architecture',
      title: 'How it fits together',
      body: project.summary,
      architecture: project.architecture,
      speech: 'Here is how the system fits together.',
    });
  }
  if (points.length) {
    beats.push({
      id: 'points',
      kicker: project.engineering ? 'Key engineering' : 'What it does',
      title: project.engineering ? 'The engineering that mattered' : 'What the product does',
      bullets: points,
      speech: firstSentences(points[0] ?? ''),
    });
  }
  // The last beat links out to the live product.
  const last = beats[beats.length - 1] as Beat;
  beats[beats.length - 1] = { ...last, link: { label: `Visit ${project.host}`, href: project.href } };

  return {
    stationId: station.id,
    title: project.name,
    eyebrow: project.openSource ? 'Open-source contribution' : 'Project',
    placeholder: false,
    beats,
  };
}

function domainBriefing(station: StationContent, id: keyof typeof domains): Briefing {
  const domain = domains[id];

  return {
    stationId: station.id,
    title: domain.title,
    eyebrow: 'Capability',
    placeholder: false,
    beats: [
      {
        id: 'overview',
        kicker: domain.label,
        title: domain.tagline,
        body: domain.summary,
        chips: domain.stack,
        speech: firstSentences(domain.summary),
      },
      {
        id: 'capabilities',
        kicker: 'Capabilities',
        title: 'What this covers',
        items: domain.capabilities.slice(0, 4).map((capability) => ({
          title: capability.title,
          body: capability.description,
        })),
        link: { label: `Explore ${domain.title}`, href: domainHref(domain.id) },
        speech: firstSentences(domain.capabilities[0]?.description ?? ''),
      },
    ],
  };
}

function welcomeBriefing(station: StationContent): Briefing {
  return {
    stationId: station.id,
    title: profile.name,
    eyebrow: station.title,
    placeholder: false,
    beats: [
      {
        id: 'welcome',
        kicker: profile.role,
        title: profile.tagline,
        body: profile.availability.detail,
        link: { label: 'Start a project', href: sectionHref.contact },
        speech: `I am the guide to ${profile.name}'s engineering universe. ${profile.tagline}`,
      },
    ],
  };
}

function careerBriefing(station: StationContent): Briefing {
  return {
    stationId: station.id,
    title: station.title,
    eyebrow: 'Experience',
    placeholder: experience.some((entry) => entry.placeholder),
    beats: experience.map((entry, index) => ({
      id: entry.id,
      kicker: entry.period,
      title: `${entry.organisation} · ${entry.role}`,
      body: `${entry.location}. ${entry.summary}`,
      bullets: entry.highlights.slice(0, 4),
      chips: entry.stack,
      ...(index === experience.length - 1
        ? { link: { label: 'See the full timeline', href: sectionHref.experience } }
        : {}),
      speech: firstSentences(entry.summary),
    })),
  };
}

function capabilitiesBriefing(station: StationContent): Briefing {
  return {
    stationId: station.id,
    title: station.title,
    eyebrow: 'Experience',
    placeholder: false,
    beats: [
      {
        id: 'matrix',
        kicker: `${profile.yearsExperience} years`,
        title: 'The working toolbox',
        items: stackGroups.map((group) => ({
          title: group.label,
          body: group.items.map((item) => item.name).join(' · '),
        })),
        link: { label: 'See the capability matrix', href: sectionHref.experience },
        speech: `${profile.yearsExperience} years across ${stackGroups
          .map((group) => group.label)
          .join(', ')}.`,
      },
    ],
  };
}

function aboutBriefing(station: StationContent): Briefing {
  return {
    stationId: station.id,
    title: station.title,
    eyebrow: profile.role,
    placeholder: false,
    beats: [
      {
        id: 'about',
        kicker: profile.availability.label,
        title: profile.tagline,
        body: profile.availability.detail,
        link: { label: 'More about how I work', href: sectionHref.about },
        speech: `${profile.name} is a ${profile.role} with ${profile.yearsExperience} years of experience.`,
      },
    ],
  };
}

function principlesBriefing(station: StationContent): Briefing {
  return {
    stationId: station.id,
    title: station.title,
    eyebrow: 'How the work gets done',
    placeholder: false,
    beats: [
      {
        id: 'principles',
        kicker: 'Principles',
        title: station.title,
        items: principles.slice(0, 4),
        link: { label: 'Read all of them', href: sectionHref.about },
        speech: firstSentences(principles[0]?.body ?? ''),
      },
    ],
  };
}

function servicesBriefing(station: StationContent): Briefing {
  return {
    stationId: station.id,
    title: station.title,
    eyebrow: 'Work together',
    placeholder: false,
    beats: [
      {
        id: 'services',
        kicker: 'Services',
        title: 'What can be built with you',
        items: services.slice(0, 4).map((service) => ({
          title: service.title,
          body: `${service.summary} Typically ${service.typicalScope}.`,
        })),
        link: { label: 'See all services', href: sectionHref.services },
        speech: firstSentences(services[0]?.summary ?? ''),
      },
      {
        id: 'small-tasks',
        kicker: 'Small tasks',
        title: 'Smaller jobs are welcome too',
        items: smallTasks.slice(0, 4).map((task) => ({
          title: task.title,
          body: `${task.description} Usually ${task.turnaround}.`,
        })),
        link: { label: 'Start a project', href: sectionHref.contact },
        speech: firstSentences(smallTasks[0]?.description ?? ''),
      },
    ],
  };
}

export function buildBriefing(station: StationContent): Briefing {
  const { subject } = station;

  switch (subject.type) {
    case 'project': {
      const project = archiveProjects.find((entry) => entry.slug === subject.slug);
      if (!project) throw new Error(`Unknown project "${subject.slug}" in universe data`);
      return projectBriefing(station, project);
    }
    case 'domain':
      return domainBriefing(station, subject.domain);
    case 'welcome':
      return welcomeBriefing(station);
    case 'career':
      return careerBriefing(station);
    case 'capabilities':
      return capabilitiesBriefing(station);
    case 'about':
      return aboutBriefing(station);
    case 'principles':
      return principlesBriefing(station);
    case 'services':
      return servicesBriefing(station);
  }
}
