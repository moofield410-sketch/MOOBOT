import { ViewTransition } from "react";

/**
 * A template re-mounts on every navigation, so its <ViewTransition> runs the "page-in" enter
 * animation (a light fade/blur-in, see globals.css) on route changes. Browsers without the View
 * Transitions API skip it and the page simply appears.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-in" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
