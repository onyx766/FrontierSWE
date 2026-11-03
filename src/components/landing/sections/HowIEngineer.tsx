import { Icon } from '@/components/landing/primitives/Icon';
import { LpButton } from '@/components/landing/primitives/LpButton';
import { SectionHeading, SectionShell } from '@/components/landing/primitives/SectionHeading';
import { TechIcon } from '@/components/landing/primitives/TechIcon';
import { Reveal } from '@/components/primitives/Reveal';
import { architectureIntro, flowPath, flowStores, type FlowNode } from '@/data/landing';
import { FlowDiagram, type FlowNodeView } from './FlowDiagram';

/** Glyphs render here, on the server: the diagram's bundle carries no icon set. */
function toView(node: FlowNode): FlowNodeView {
  return {
    id: node.id,
    label: node.label,
    caption: node.caption,
    detail: node.detail,
    icon: node.tech ? (
      <TechIcon name={node.tech} className="size-full" />
    ) : (
      <Icon name={node.icon} className="size-[88%]" strokeWidth={1.7} />
    ),
  };
}

/**
 * How I engineer: one request's path from a person to the data stores, as an
 * interactive diagram. The flow animates on its own; picking a layer explains
 * what that layer is responsible for.
 */
export function HowIEngineer() {
  const summary = `A request travels from ${flowPath
    .map((node) => node.label)
    .join(' to ')}, which reads and writes ${flowStores.map((node) => node.label).join(' and ')}.`;

  return (
    <SectionShell
      id="architecture"
      labelledBy="architecture-title"
      heading={
        <SectionHeading
          id="architecture-title"
          title={architectureIntro.title}
          description={architectureIntro.description}
        >
          <LpButton href={architectureIntro.more.href} variant="outline" size="sm">
            {architectureIntro.more.label}
          </LpButton>
        </SectionHeading>
      }
    >
      <Reveal delay={0.08}>
        <FlowDiagram path={flowPath.map(toView)} stores={flowStores.map(toView)} summary={summary} />
      </Reveal>
    </SectionShell>
  );
}
