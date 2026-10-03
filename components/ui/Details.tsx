/** "Details" expander for technical fields (full addresses, tx hashes, blocks). */
export function Details({ label = "Details", children }: { label?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-4 border-t border-line pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm pointer-coarse:min-h-11 font-medium text-soil/80 hover:text-grass [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>
        {label}
      </summary>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </details>
  );
}

export function DetailRow({ label, value, href }: { label: string; value: string; href?: string | null }) {
  return (
    <div>
      <p className="text-xs text-soil/60">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="link break-all font-mono text-xs pointer-coarse:inline-block pointer-coarse:py-3.5">
          {value}
        </a>
      ) : (
        <p className="break-all font-mono text-xs text-soil/85">{value}</p>
      )}
    </div>
  );
}
