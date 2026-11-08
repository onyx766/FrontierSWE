import Image from 'next/image';
import { Icon } from '@/components/landing/primitives/Icon';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { Eyebrow } from '@/components/landing/primitives/SectionHeading';
import { Reveal, RevealGroup } from '@/components/primitives/Reveal';
import {
  archiveProjects,
  disciplineCounts,
  projectAnchor,
  projectsIntro,
  type LandingProject,
} from '@/data/landing';
import { cn } from '@/lib/utils';
import { KanbanArt, LedgerArt } from './OpenSourceArt';
import { ProjectsStarfield } from './ProjectsStarfield';
import { ProjectVisual } from './ProjectVisual';
import styles from './Projects.module.css';
import a from './ProjectsArchive.module.css';
import { TiltStage } from './TiltStage';

const TOTAL = archiveProjects.length;
const pad = (value: number) => String(value).padStart(2, '0');
const numberOf = (project: LandingProject) => archiveProjects.indexOf(project) + 1;
const titleId = (project: LandingProject) => `${projectAnchor(project.slug)}-title`;

/* ───────────────────────────── Shared pieces ────────────────────────────── */

function Meta({ project, className }: { project: LandingProject; className?: string }) {
  return (
    <p className={cn(a.meta, className)}>
      <span className={a.metaNum}>
        {pad(numberOf(project))} <span className={a.metaOf}>/ {pad(TOTAL)}</span>
      </span>
      <span className={a.metaCat}>{project.category}</span>
      {project.openSource ? <span className={a.metaOpen}>Open source</span> : null}
    </p>
  );
}

/** A huge outlined numeral behind a showcase: the archive's catalogue mark. */
function Numeral({ project }: { project: LandingProject }) {
  return (
    <span className={a.numeral} aria-hidden="true">
      {pad(numberOf(project))}
    </span>
  );
}

function Contribution({ project }: { project: LandingProject }) {
  return (
    <div className={a.role}>
      <p className={a.label}>My role</p>
      <p className={a.roleText}>{project.contribution}</p>
    </div>
  );
}

/** Engineering verified in the code, or, failing that, what the product does. */
function Points({ project, columns = false }: { project: LandingProject; columns?: boolean }) {
  const verified = Boolean(project.engineering?.length);
  const items = project.engineering ?? project.capabilities ?? [];
  if (!items.length) return null;
  return (
    <div className={a.points}>
      <p className={a.label}>{verified ? 'Key engineering work' : 'What it does'}</p>
      <ul className={cn(a.pointList, columns && a.pointColumns)}>
        {items.map((item, i) => (
          <li key={item}>
            <span className={a.pointNum} aria-hidden="true">
              {pad(i + 1)}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stack({ project }: { project: LandingProject }) {
  if (!project.stack.length) return null;
  return (
    <ul className={a.stack} aria-label="Technologies">
      {project.stack.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Visit({ project }: { project: LandingProject }) {
  return (
    <LpButton
      href={project.href}
      variant="light"
      size="md"
      icon="arrow-up-right"
      magnetic
      external
      ariaLabel={`Visit ${project.name} at ${project.host} (opens in a new tab)`}
    >
      {`Visit ${project.host}`}
    </LpButton>
  );
}

/** A screenshot of the live product in browser chrome. */
function BrowserFrame({
  project,
  className,
  sizes,
}: {
  project: LandingProject;
  className?: string;
  sizes: string;
}) {
  if (!project.screenshot) return null;
  return (
    <figure className={cn(a.browser, className)}>
      <div className={a.browserBar} aria-hidden="true">
        <span className={a.browserDots}>
          <i />
          <i />
          <i />
        </span>
        <span className={a.browserUrl}>{project.host}</span>
      </div>
      <div className={a.browserShot}>
        <Image src={project.screenshot.src} alt={project.screenshot.alt} width={1440} height={900} sizes={sizes} />
      </div>
    </figure>
  );
}

/** The showcase visual: the animated 3D stage with the live site beside it, or the site alone. */
function ShowcaseVisual({ project }: { project: LandingProject }) {
  if (project.visual) {
    return (
      <TiltStage className={a.stage}>
        <div className={a.stageArt}>
          <ProjectVisual kind={project.visual} />
        </div>
        <BrowserFrame project={project} className={a.stageShot} sizes="(min-width: 1024px) 22rem, 60vw" />
      </TiltStage>
    );
  }
  return (
    <TiltStage className={cn(a.stage, a.stageSolo)} max={5}>
      <BrowserFrame project={project} className={a.soloShot} sizes="(min-width: 1024px) 40rem, 92vw" />
    </TiltStage>
  );
}

/* ─────────────────────────────── Layouts ────────────────────────────────── */

/** Text on one side, a large visual on the other. */
function SplitShowcase({ project }: { project: LandingProject }) {
  return (
    <article
      id={projectAnchor(project.slug)}
      aria-labelledby={titleId(project)}
      className={a.split}
      data-reverse={project.layout === 'split-reverse' ? '' : undefined}
    >
      <Numeral project={project} />
      <Reveal className={a.splitText}>
        <Meta project={project} />
        <h3 id={titleId(project)} className={a.title}>
          {project.name}
        </h3>
        <p className={a.tagline}>{project.tagline}</p>
        <p className={a.summary}>{project.summary}</p>
        <Contribution project={project} />
        <Points project={project} />
        <Stack project={project} />
        <div className={a.cta}>
          <Visit project={project} />
        </div>
      </Reveal>
      <Reveal delay={0.1} className={a.splitVisual}>
        <ShowcaseVisual project={project} />
      </Reveal>
    </article>
  );
}

/** A full-width feature: heading row, then a panoramic visual, then the detail in columns. */
function WideShowcase({ project }: { project: LandingProject }) {
  return (
    <article id={projectAnchor(project.slug)} aria-labelledby={titleId(project)} className={a.wide}>
      <Numeral project={project} />
      <Reveal className={a.wideHead}>
        <div>
          <Meta project={project} />
          <h3 id={titleId(project)} className={a.title}>
            {project.name}
          </h3>
          <p className={a.tagline}>{project.tagline}</p>
        </div>
        <div>
          <p className={a.summary}>{project.summary}</p>
          <Contribution project={project} />
        </div>
      </Reveal>

      <Reveal delay={0.08} className={a.wideVisual}>
        <TiltStage className={a.wideStage} max={5}>
          <div className={a.wideArt}>
            {project.visual ? <ProjectVisual kind={project.visual} /> : null}
          </div>
          <BrowserFrame project={project} className={a.wideShot} sizes="(min-width: 1024px) 34rem, 92vw" />
        </TiltStage>
      </Reveal>

      <Reveal className={a.wideFoot}>
        <Points project={project} columns />
        <div className={a.wideActions}>
          <Stack project={project} />
          <Visit project={project} />
        </div>
      </Reveal>
    </article>
  );
}

/** Two products side by side, each led by a large screenshot; the second sits lower. */
function PairShowcase({ projects }: { projects: LandingProject[] }) {
  return (
    <div className={a.pair}>
      {projects.map((project, i) => (
        <Reveal
          key={project.slug}
          as="article"
          id={projectAnchor(project.slug)}
          aria-labelledby={titleId(project)}
          delay={i * 0.08}
          className={a.pairItem}
        >
          <TiltStage className={a.pairStage} max={4}>
            <BrowserFrame project={project} className={a.pairShot} sizes="(min-width: 1024px) 36rem, 92vw" />
          </TiltStage>
          <div className={a.pairBody}>
            <Meta project={project} />
            <h3 id={titleId(project)} className={cn(a.title, a.titleMid)}>
              {project.name}
            </h3>
            <p className={a.tagline}>{project.tagline}</p>
            <p className={a.summary}>{project.summary}</p>
            <Contribution project={project} />
            <Points project={project} />
            <Stack project={project} />
            <div className={a.cta}>
              <Visit project={project} />
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/** Open-source PHP products Onyx worked on, framed clearly as not his to claim. */
function OpenSourceShowcase({ projects }: { projects: LandingProject[] }) {
  return (
    <div className={a.oss}>
      <Reveal className={a.ossHead}>
        <p className={a.ossKicker}>
          <Icon name="code" className="size-4" strokeWidth={2} />
          Open-source PHP
        </p>
        <p className={a.ossNote}>
          These are community-maintained open-source products. The work shown is my PHP development on them, not
          the products themselves.
        </p>
      </Reveal>
      <div className={a.ossGrid}>
        {projects.map((project, i) => (
          <Reveal
            key={project.slug}
            as="article"
            id={projectAnchor(project.slug)}
            aria-labelledby={titleId(project)}
            delay={i * 0.08}
            className={a.ossItem}
          >
            <TiltStage className={a.ossStage} max={4}>
              {project.slug === 'kanboard' ? <KanbanArt /> : <LedgerArt />}
            </TiltStage>
            <div className={a.ossBody}>
              <Meta project={project} />
              <h3 id={titleId(project)} className={cn(a.title, a.titleMid)}>
                {project.name}
              </h3>
              <Contribution project={project} />
              <div className={a.platform}>
                <p className={a.label}>About the platform</p>
                <p className={a.platformText}>{project.summary}</p>
              </div>
              <Stack project={project} />
              <div className={a.cta}>
                <Visit project={project} />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/** Groups consecutive pair / open-source projects so each group renders as one layout. */
function groupProjects(projects: LandingProject[]) {
  const groups: { layout: LandingProject['layout']; projects: LandingProject[] }[] = [];
  for (const project of projects) {
    const last = groups[groups.length - 1];
    const groupable = project.layout === 'pair' || project.layout === 'open-source';
    if (groupable && last && last.layout === project.layout) last.projects.push(project);
    else groups.push({ layout: project.layout, projects: [project] });
  }
  return groups;
}

/* ─────────────────────────────── Section ────────────────────────────────── */

/**
 * Projects — the Engineering Work Archive. The page's one dark band: a
 * heading with the disciplines the work spans, an index of every project,
 * then each project in a layout of its own.
 */
export function Projects() {
  const groups = groupProjects(archiveProjects);
  const words = projectsIntro.title.split(' ');
  const accent = words.pop();

  return (
    <section id="projects" aria-labelledby="projects-title" className={cn('lp-section', styles.band, a.section)}>
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.glowViolet} />
        <div className={styles.glowLilac} />
        <div className={styles.glowPink} />
        <div className={styles.gridLines} />
        <ProjectsStarfield className={styles.stars} />
      </div>

      <div className="lp-container">
        {/* ── Heading ── */}
        <header className={a.head}>
          <Reveal>
            <Eyebrow tone="dark">{projectsIntro.eyebrow}</Eyebrow>
            <h2 id="projects-title" className={a.h2}>
              {words.join(' ')} <span className={a.h2Accent}>{accent}</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08} className={a.headSide}>
            <p className={a.lead}>{projectsIntro.description}</p>
            <RevealGroup as="ul" role="list" aria-label="Disciplines" className={a.disciplines}>
              {disciplineCounts.map((discipline) => (
                <li key={discipline.id} className={a.discipline}>
                  <span className={a.disciplineIcon} aria-hidden="true">
                    <Icon name={discipline.icon} strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className={a.disciplineName}>{discipline.label}</span>
                    <span className={a.disciplineCount}>
                      {discipline.count} {discipline.count === 1 ? 'project' : 'projects'}
                    </span>
                  </span>
                </li>
              ))}
            </RevealGroup>
          </Reveal>
        </header>

        {/* ── Index ── */}
        <Reveal as="nav" aria-labelledby="project-index-title" className={a.index}>
          <h3 id="project-index-title" className={a.indexTitle}>
            {projectsIntro.indexTitle}
          </h3>
          <ol className={a.indexList}>
            {archiveProjects.map((project) => (
              <li key={project.slug}>
                <a href={`#${projectAnchor(project.slug)}`} className={a.indexRow}>
                  <span className={a.indexNum}>{pad(numberOf(project))}</span>
                  <span className={a.indexName}>{project.name}</span>
                  <span className={a.indexCat}>{project.category}</span>
                  <span className={a.indexArrow} aria-hidden="true">
                    <Icon name="arrow-right" strokeWidth={2} />
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* ── The archive ── */}
        <div className={a.archive}>
          {groups.map((group) => {
            const key = group.projects.map((project) => project.slug).join('+');
            const [first] = group.projects;
            if (!first) return null;
            if (group.layout === 'pair') return <PairShowcase key={key} projects={group.projects} />;
            if (group.layout === 'open-source') return <OpenSourceShowcase key={key} projects={group.projects} />;
            if (group.layout === 'wide') return <WideShowcase key={key} project={first} />;
            return <SplitShowcase key={key} project={first} />;
          })}
        </div>
      </div>
    </section>
  );
}
