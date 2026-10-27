import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-forest text-paper", className)}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none">
        <path
          d="M5.5 18.5 9 6.5l9.5 6.5-5.5 5.5-7.5-.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="11.2" cy="12.1" r="1.15" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", subtle = false }: { href?: string; subtle?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="Wayfarer home">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-3" />
      <span className={cn("display text-[1.25rem] tracking-[-0.04em]", subtle ? "text-ink" : "")}>Wayfarer</span>
    </Link>
  );
}
