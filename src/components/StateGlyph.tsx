import type { FindingStatus } from '../api/types';

/** State glyphs are the non-colour channel for finding status (DESIGN.md section 8). */
export function StateGlyph({ status }: { status: FindingStatus }) {
  const common = {
    className: 'glyph',
    viewBox: '0 0 16 16',
    'aria-hidden': true,
    focusable: false,
  } as const;
  switch (status) {
    case 'scored':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="10" height="10" fill="currentColor" />
        </svg>
      );
    case 'not_evaluated':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'unavailable':
      return (
        <svg {...common}>
          <circle
            cx="8"
            cy="8"
            r="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="2.5 2"
          />
        </svg>
      );
    case 'unsupported':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.5 11.5l7-7" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'failed':
      return (
        <svg {...common} style={{ color: 'var(--ks-lb-failed)' }}>
          <path d="M8 2.5l6 10.5H2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 6.5v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

export function HatchBlock() {
  return <span className="hatch-block" aria-hidden="true" />;
}
