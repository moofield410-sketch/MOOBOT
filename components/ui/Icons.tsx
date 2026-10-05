type P = { className?: string };

export const LockIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor" shapeRendering="crispEdges">
    <path d="M5 7V5a3 3 0 0 1 6 0v2h1v7H4V7h1Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" />
  </svg>
);

export const InfoIcon = ({ className = "h-3.5 w-3.5" }: P) => (
  <svg viewBox="0 0 16 16" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 7v4.5M8 4.5v.5" strokeLinecap="square" />
  </svg>
);

export const XIcon =({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
    <path d="M17.7 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.9L17.7 3Zm-1.1 16.2h1.7L7.5 4.7H5.6l11 14.5Z" />
  </svg>
);

export const TelegramIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
    <path d="M21.4 3.6 2.9 10.7c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5ZM9 13.4l9.4-5.9c.4-.3.8-.1.5.2l-7.9 7.2-.3 3.4L9 13.4Z" />
  </svg>
);

export const DiscordIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
    <path d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1a15.7 15.7 0 0 0-5.8 0l-.5-1a17 17 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.3 17a17 17 0 0 0 5.2 2.6l1.1-1.8c-.6-.2-1.2-.5-1.8-.9l.4-.3a12.2 12.2 0 0 0 11.6 0l.4.3c-.6.4-1.2.7-1.8.9l1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.4-.7-8.3-3.1-11.7ZM8.5 14.7c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Zm7 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Z" />
  </svg>
);

export const GitHubIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
    <path d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7 0-.7 0-.7 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.1 3.1.9.1-.7.4-1.1.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.3.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.3 0c2-1.4 2.9-1.1 2.9-1.1.6 1.5.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v2.9c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5Z" />
  </svg>
);

export const MenuIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 20 20" aria-hidden className={className} fill="currentColor" shapeRendering="crispEdges">
    <rect x="2" y="4" width="16" height="2" />
    <rect x="2" y="9" width="16" height="2" />
    <rect x="2" y="14" width="16" height="2" />
  </svg>
);

export const CloseIcon = ({ className = "h-5 w-5" }: P) => (
  <svg viewBox="0 0 20 20" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4l12 12M16 4 4 16" />
  </svg>
);

export const SearchIcon = ({ className = "h-4 w-4" }: P) => (
  <svg viewBox="0 0 20 20" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="m13 13 4.5 4.5" />
  </svg>
);
