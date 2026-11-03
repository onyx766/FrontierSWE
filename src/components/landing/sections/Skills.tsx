import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '@/components/landing/primitives/Icon';
import { SectionHeading, SectionShell } from '@/components/landing/primitives/SectionHeading';
import { TechIcon } from '@/components/landing/primitives/TechIcon';
import { Reveal } from '@/components/primitives/Reveal';
import { skillTabs, skillsIntro, type SkillTab } from '@/data/landing';
import { SkillsCube, SkillsTabs } from './SkillsTabs';
import styles from './Skills.module.css';

const CUBE_FACES = 6;

const pad = (value: number) => String(value).padStart(2, '0');

/** The words inside a tab. Ids let the tab name itself by its label alone and keep the caption as its description. */
function TabFace({ tab }: { tab: SkillTab }) {
  return (
    <>
      <span aria-hidden className={styles.tabIcon}>
        <Icon name={tab.icon} className="size-[1.15rem]" />
      </span>
      <span className={styles.tabText}>
        <span id={`skills-tab-${tab.id}-label`} className={styles.tabLabel}>
          {tab.label}
        </span>
        <span id={`skills-tab-${tab.id}-caption`} className={styles.tabCaption}>
          {tab.caption}
        </span>
      </span>
    </>
  );
}

function SkillPanel({ tab, index, total }: { tab: SkillTab; index: number; total: number }) {
  return (
    <div className={styles.panelGrid}>
      <div className={styles.panelCopy}>
        <div className={styles.panelHead}>
          <h3 className={styles.panelTitle}>
            <span aria-hidden className={styles.dot} />
            {tab.title}
          </h3>
          <p aria-hidden className={styles.panelCount}>
            {pad(index + 1)} / {pad(total)}
          </p>
        </div>
        <p className={styles.panelText}>{tab.description}</p>
        <ul className={styles.highlights}>
          {tab.highlights.map((item, itemIndex) => (
            <li key={item} className={styles.highlight} style={{ '--i': itemIndex } as CSSProperties}>
              <span aria-hidden className={styles.check}>
                <Icon name="check" className="size-3" strokeWidth={2.6} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <ul aria-label={`${tab.label} tools`} className={styles.tools}>
        {tab.tools.map((tool, toolIndex) => (
          <li key={tool.name} className={styles.tool} style={{ '--i': toolIndex } as CSSProperties}>
            <span className={styles.toolGlyph}>
              <TechIcon name={tool.icon} className="size-7" />
            </span>
            <span className={styles.toolName}>{tool.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "My Skills": a tab per area (AI, backend, frontend, data, infrastructure),
 * each opening a panel of highlights and the tools used. The heading column
 * carries a cube that turns to the selected area on wide screens.
 */
export function Skills() {
  const total = skillTabs.length;

  // One face per area; spare faces carry the spark.
  const faces: ReactNode[] = Array.from({ length: CUBE_FACES }, (_, faceIndex) => {
    const tab = skillTabs[faceIndex];
    if (!tab) return <Icon key={`spare-${faceIndex}`} name="spark" className="size-6" />;
    return (
      <Fragment key={tab.id}>
        <Icon name={tab.icon} className="size-7" />
        <span className={styles.faceLabel}>{tab.label}</span>
      </Fragment>
    );
  });

  return (
    <SectionShell
      id="skills"
      labelledBy="skills-title"
      className={styles.section}
      // A slightly narrower heading column at xl, so five tabs fit side by
      // side with their icons, as in the design.
      gridClassName="xl:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)] xl:gap-x-12"
      heading={
        <>
          <SectionHeading id="skills-title" title={skillsIntro.title} description={skillsIntro.description} />
          <Reveal delay={0.12} className="mt-8 hidden lg:block">
            <SkillsCube faces={faces} />
          </Reveal>
        </>
      }
    >
      <Reveal>
        <SkillsTabs
          ids={skillTabs.map((tab) => tab.id)}
          label="Skill areas"
          tabs={skillTabs.map((tab) => (
            <TabFace key={tab.id} tab={tab} />
          ))}
          panels={skillTabs.map((tab, index) => (
            <SkillPanel key={tab.id} tab={tab} index={index} total={total} />
          ))}
        />
      </Reveal>
    </SectionShell>
  );
}
