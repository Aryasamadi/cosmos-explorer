import type { ReactNode, SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function IconFrame({
  size = 20,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconOrbit(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(-24 12 12)" />
      <circle cx="19.1" cy="7.8" r="1.15" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.7 3 2.7 15 0 18M12 3c-2.7 3-2.7 15 0 18" />
      <path d="M5.3 6.2c4.1 1.7 9.3 1.7 13.4 0M5.3 17.8c4.1-1.7 9.3-1.7 13.4 0" opacity=".75" />
    </IconFrame>
  );
}

export function IconCompass(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function IconGear(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.1M12 19.1v2.1M4.3 7l1.8 1M17.9 16l1.8 1M4.3 17l1.8-1M17.9 8l1.8-1M2.8 12h2.1M19.1 12h2.1" />
    </IconFrame>
  );
}

export function IconClose(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconFrame>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5V17" />
      <circle cx="12" cy="7.5" r=".9" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function IconReset(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.5 9.2A8 8 0 1 1 4 14" />
      <path d="M4.2 4.4v5h5" />
    </IconFrame>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </IconFrame>
  );
}

export function IconSensor(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="8" y="2.8" width="8" height="18.4" rx="2" />
      <path d="M10.5 18.5h3" />
      <path d="M4.2 8.5A6.4 6.4 0 0 0 4.2 15.5M19.8 8.5a6.4 6.4 0 0 1 0 7" opacity=".65" />
    </IconFrame>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M3 7.8h3.1l1.4-2.1h9l1.4 2.1H21v11H3v-11Z" />
      <circle cx="12" cy="13" r="3.6" />
    </IconFrame>
  );
}

export function IconList(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.7" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="3.7" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="3.7" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function IconPin(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 21s6.5-5.5 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.5 12 21 12 21Z" />
      <circle cx="12" cy="10" r="2.5" />
    </IconFrame>
  );
}

export function IconClock(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.8V12l3.4 2.1" />
    </IconFrame>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </IconFrame>
  );
}

export function IconWarning(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M14 4h6v6M20 4 10.5 13.5" />
      <path d="M19 14.5v5H4.5v-14H10" />
    </IconFrame>
  );
}

export function IconEye(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </IconFrame>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconFrame>
  );
}
