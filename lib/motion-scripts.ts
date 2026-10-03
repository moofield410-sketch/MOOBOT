/**
 * Inline script for the <head>: hide scroll-reveal targets only when the observer in
 * components/motion/PointerEffects.tsx can show them again (IntersectionObserver present and no
 * reduced-motion preference). Kept out of the "use client" module so the server layout gets the string.
 */
export const REVEAL_SCRIPT = `try{if("IntersectionObserver"in window&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("reveal-ready")}catch(e){}`;
