"use client";

import { CloseIcon } from "@/components/ui/Icons";

export const PREVIEW_DISMISS_KEY = "moobot-preview-dismissed";

/**
 * Runs before first paint so a banner dismissed earlier this session never flashes.
 * Session-only on purpose: a new visit shows the banner again.
 */
export const PREVIEW_BANNER_SCRIPT = `try{if(sessionStorage.getItem("${PREVIEW_DISMISS_KEY}"))document.documentElement.dataset.previewDismissed="1"}catch(e){}`;

export function PreviewBanner() {
  const dismiss = () => {
    try {
      sessionStorage.setItem(PREVIEW_DISMISS_KEY, "1");
    } catch {
      /* storage unavailable: still hide for this page view */
    }
    document.documentElement.dataset.previewDismissed = "1";
  };

  return (
    <div className="preview-banner border-b border-line bg-oat" role="region" aria-label="Preview notice">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 py-2 sm:px-6">
        <p className="text-center text-sm text-soil">
          <span className="font-semibold text-grass">Preview mode:</span> sample data until launch
        </p>
        <button type="button" onClick={dismiss} aria-label="Dismiss preview notice" className="p-1 text-soil/70 hover:text-soil">
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
