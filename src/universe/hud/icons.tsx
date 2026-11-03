import type { SVGProps } from 'react';

/** Small line icons, inline so the HUD paints with the first HTML. */

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowUpRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 13 13 3M5 3h8v8" />
    </Icon>
  );
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m6 3 5 5-5 5" />
    </Icon>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m3 6 5 5 5-5" />
    </Icon>
  );
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </Icon>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m3.5 8.5 3 3 6-7" />
    </Icon>
  );
}

export function SpeakerIcon({ muted, ...props }: SVGProps<SVGSVGElement> & { muted: boolean }) {
  return (
    <Icon {...props}>
      <path d="M2.5 6v4h2.6L9 13V3L5.1 6H2.5Z" />
      {muted ? (
        <path d="m11.5 6.2 3 3.6M14.5 6.2l-3 3.6" />
      ) : (
        <path d="M11.5 5.5a3.6 3.6 0 0 1 0 5M13.2 3.8a6 6 0 0 1 0 8.4" />
      )}
    </Icon>
  );
}

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2.5 5h11M2.5 11h11" />
    </Icon>
  );
}
