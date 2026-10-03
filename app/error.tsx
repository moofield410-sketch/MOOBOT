"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-3xl font-extrabold text-soil">Something went wrong</h1>
      <p className="mt-3 text-soil/80">This page didn&apos;t load properly. Please try again.</p>
      <button type="button" onClick={reset} className="btn-primary mt-8">
        Try again
      </button>
    </div>
  );
}
