import Link from "next/link";
import { MooBotMascot } from "@/components/MooBotMascot";

export default function NotFound() {
  return (
    <div className="relative mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <div aria-hidden className="halo left-1/2 top-4 h-72 w-72 -translate-x-1/2 opacity-70" />
      <div className="relative">
        <MooBotMascot state="thinking" size={200} title="MooBot, scanning for the page" />
      </div>
      <p className="eyebrow mt-6 justify-center">Signal lost.</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-soil">Page not found</h1>
      <p className="mt-3 text-fern">MooBot looked everywhere, but this page isn&apos;t in the Field.</p>
      <Link href="/" className="btn-primary mt-8">
        Back to home
      </Link>
    </div>
  );
}
