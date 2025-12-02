import React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

function createIcon(paths: React.ReactNode) {
  return React.forwardRef<SVGSVGElement, IconProps>(function Icon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {paths}
      </svg>
    );
  });
}

export const Brain = createIcon(
  <>
    <path d="M12 4c-1.5-1-3.5-.5-4.5 1-.6.9-.5 2-.5 3.5-1 .5-1.5 1.6-1.5 2.8 0 1.5.8 2.8 2 3.4V18a3 3 0 0 0 3 3" />
    <path d="M12 4c1.5-1 3.5-.5 4.5 1 .6.9.5 2 .5 3.5 1 .5 1.5 1.6 1.5 2.8 0 1.5-.8 2.8-2 3.4V18a3 3 0 0 1-3 3" />
    <path d="M12 7v4" />
    <path d="M9 9h2" />
    <path d="M13 11h2" />
  </>
);

export const ShieldCheck = createIcon(
  <>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </>
);

export const Activity = createIcon(
  <>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </>
);

export const ArrowUpRight = createIcon(
  <>
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </>
);

export const Github = createIcon(
  <>
    <path d="M15 22v-3.5a3.5 3.5 0 0 0-1-2.5c3 0 6-2 6-5.5A5.5 5.5 0 0 0 18.5 5" />
    <path d="M18.5 5a4.3 4.3 0 0 0-.1-2.7s-1-.3-3.4 1.2a11.8 11.8 0 0 0-5 0C7.5 2 6.5 2.3 6.5 2.3A4.3 4.3 0 0 0 6.4 5" />
    <path d="M12 15.5c-3.5 1-4-1.5-5-2" />
    <path d="M9 17.5s-.5 1 1 1.5" />
    <path d="M15 19s.1 1-1 1" />
  </>
);

export const Globe = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 3.5 2.5 14.5 0 18" />
    <path d="M12 3c-2.5 3.5-2.5 14.5 0 18" />
  </>
);

export const Command = createIcon(
  <>
    <path d="M5 9h2a2 2 0 0 0 2-2V5a2 2 0 1 0-4 0v10a2 2 0 1 0 4 0v-2a2 2 0 0 1 2-2h2" />
    <path d="M15 9h2a2 2 0 1 0-2-2v10a2 2 0 1 0 2-2h-2a2 2 0 0 1-2-2V9" />
  </>
);

export const Component = createIcon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <path d="M10 7h4" />
    <path d="M17 10v4" />
  </>
);

export const Network = createIcon(
  <>
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="6" r="2" />
    <circle cx="12" cy="18" r="3" />
    <path d="M7 7.5 10.5 14" />
    <path d="M17 7.5 13.5 14" />
    <path d="M5 8v3" />
    <path d="M19 8v3" />
  </>
);

export { Component as ComponentIcon };
