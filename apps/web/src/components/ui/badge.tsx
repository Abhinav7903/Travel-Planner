import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "forest" | "clay" | "sand" | "outline";
  className?: string;
}) {
  const tones = {
    neutral: "bg-[#efebe2] text-ink-soft",
    forest: "bg-forest-soft text-forest",
    clay: "bg-[#f5e9e0] text-[#9a5939]",
    sand: "bg-sand text-[#736b59]",
    outline: "border border-line-strong text-ink-soft",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.01em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
