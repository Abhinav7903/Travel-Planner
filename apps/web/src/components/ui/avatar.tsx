import { cn, initials } from "@/lib/utils";

const palette = [
  "bg-[#dce8de] text-[#26523f]",
  "bg-[#efe1d5] text-[#8b5236]",
  "bg-[#e3e1ef] text-[#4e4a70]",
  "bg-[#eee9ce] text-[#736329]",
  "bg-[#dbe6e9] text-[#345b66]",
  "bg-[#eadde1] text-[#7a4556]",
];

function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length]!;
}

export function Avatar({
  name,
  id = name,
  size = "md",
  className,
}: {
  name: string;
  id?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[9px]",
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-[11px]",
    lg: "h-12 w-12 text-[14px]",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[0.03em]",
        sizes[size],
        colorFor(id),
        className,
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4 }: { people: Array<{ id: string; name: string }>; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <Avatar
          key={person.id}
          name={person.name}
          id={person.id}
          size="xs"
          className={cn("ring-2 ring-paper", index > 0 && "-ml-1.5")}
        />
      ))}
      {rest > 0 ? (
        <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#e8e3d7] text-[9px] font-semibold text-ink-soft ring-2 ring-paper">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
