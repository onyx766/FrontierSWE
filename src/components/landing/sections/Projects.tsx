import Link from 'next/link';
import { Icon } from '@/components/landing/primitives/Icon';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { SectionHeading } from '@/components/landing/primitives/SectionHeading';
import { Reveal } from '@/components/primitives/Reveal';
import { landingProjects, projectsIntro, type LandingProject } from '@/data/landing';
import { cn } from '@/lib/utils';
import { ProjectCarousel, type CarouselSlide } from './ProjectCarousel';
import { ProjectsStarfield } from './ProjectsStarfield';
import { ProjectVisual } from './ProjectVisual';
import styles from './Projects.module.css';

const pad = (value: number) => String(value).padStart(2, '0');

/** One slide's body. Rendered here, on the server, and handed to the carousel. */
function ProjectSlide({ project, index, total }: { project: LandingProject; index: number; total: number }) {
  return (
    <>
      <div className={styles.text}>
        {/* The slide group is already labelled "1 of 3"; this is for sighted readers. */}
        <p className={styles.counter} aria-hidden="true">
          <span className={styles.counterNow}>{pad(index + 1)}</span> / {pad(total)}
        </p>
        <ul className={styles.tags} aria-label="Tags">
          {project.tags.map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
        </ul>
        <h3 className={styles.title}>{project.name}</h3>
        <p className={styles.desc}>{project.description}</p>
        <ul className={styles.stack} aria-label="Built with">
          {project.stack.map((item) => (
            <li key={item} className={styles.chip}>
              {item}
            </li>
          ))}
        </ul>
        <div className={styles.cta}>
          <LpButton
            href={project.href}
            variant="light"
            size="sm"
            icon="arrow-up-right"
            magnetic
            ariaLabel={`Explore ${project.name} in the 3D world`}
          >
            Explore in 3D
          </LpButton>
        </div>
      </div>
      <div className={styles.visualSlot}>
        <ProjectVisual kind={project.visual} />
      </div>
    </>
  );
}

/**
 * Selected Projects — the page's one dark band. A starfield canvas, violet
 * glows and a fine grid sit behind the heading and the project carousel.
 */
export function Projects() {
  const total = landingProjects.length;
  const slides: CarouselSlide[] = landingProjects.map((project, index) => ({
    id: project.slug,
    title: project.name,
    content: <ProjectSlide project={project} index={index} total={total} />,
  }));

  return (
    <section id="projects" aria-labelledby="projects-title" className={cn('lp-section', styles.band)}>
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.glowViolet} />
        <div className={styles.glowLilac} />
        <div className={styles.glowPink} />
        <div className={styles.gridLines} />
        <ProjectsStarfield className={styles.stars} />
      </div>

      {/* The reference grid, with a slimmer heading column below xl so the
          two-column card keeps room for its illustration. */}
      <div className="lp-container grid gap-10 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-center lg:gap-14 xl:grid-cols-[minmax(0,16.5rem)_minmax(0,1fr)] xl:gap-20">
        <SectionHeading
          id="projects-title"
          tone="dark"
          title={projectsIntro.title}
          description={projectsIntro.description}
        >
          <Link href={projectsIntro.allProjects.href} className={styles.allLink}>
            {projectsIntro.allProjects.label}
            <span className={styles.allLinkArrow} aria-hidden="true">
              <Icon name="arrow-right" strokeWidth={2} />
            </span>
          </Link>
        </SectionHeading>

        {slides.length > 0 ? (
          <Reveal delay={0.08} className="min-w-0">
            <ProjectCarousel slides={slides} label="Featured projects" />
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
