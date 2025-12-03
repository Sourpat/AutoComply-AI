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

export const Info = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </>
);

export const CheckCircle2 = createIcon(
  <>
    <path d="M22 11.5a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
    <path d="m9 12 2 2 4-4" />
  </>
);

export const AlertTriangle = createIcon(
  <>
    <path d="M10.3 2.3 1.8 16a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.3a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>
);

export const Ban = createIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </>
);

export const FileText = createIcon(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </>
);

export const BookOpen = createIcon(
  <>
    <path d="M12 4H5a2 2 0 0 0-2 2v14" />
    <path d="M19 20V6a2 2 0 0 0-2-2h-7" />
    <path d="M12 4v16" />
  </>
);

export const Terminal = createIcon(
  <>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" x2="20" y1="19" y2="19" />
  </>
);

export const Copy = createIcon(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>
);

export { Component as ComponentIcon };
