import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function Label({
  htmlFor,
  children,
  hint,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-1.5 flex items-baseline justify-between gap-3", className)}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-semibold tracking-[0.01em] text-ink-soft">
        {children}
      </label>
      {hint ? <span className="text-[11px] text-ink-faint">{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-line-strong bg-paper px-3 text-[14px] text-ink placeholder:text-ink-faint/80 transition-colors hover:border-[#c1baab] focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/10 disabled:bg-sand/60 disabled:text-ink-faint",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-y rounded-xl border border-line-strong bg-paper px-3 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-ink-faint/80 transition-colors hover:border-[#c1baab] focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/10 disabled:bg-sand/60",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-line-strong bg-paper bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364675e%22 stroke-width=%222%22 stroke-linecap=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')] bg-[right_12px_center] bg-no-repeat px-3 pr-9 text-[14px] text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/10 disabled:bg-sand/60",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[12px] text-[#9a4a2b]">{children}</p>;
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#e2c9bc] bg-[#fbf1eb] px-3.5 py-3 text-[13px] leading-relaxed text-[#8f4529]"
    >
      {children}
    </div>
  );
}
