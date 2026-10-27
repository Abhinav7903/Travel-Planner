import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-forest text-[#fbf9f3] shadow-[0_1px_1px_rgba(22,58,46,.18)] hover:bg-forest-deep disabled:bg-[#9eaaa0]",
  secondary:
    "border border-line-strong bg-paper text-ink hover:border-ink-faint hover:bg-[#faf7f0] disabled:text-ink-faint",
  ghost: "text-ink-soft hover:bg-[#ece7dc] hover:text-ink disabled:text-ink-faint",
  danger: "border border-[#dfc4b7] bg-[#fbf3ef] text-[#8f4529] hover:bg-[#f7e8e1]",
  quiet: "bg-forest-soft text-forest hover:bg-[#dce8de] disabled:text-ink-faint",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-[15px]",
  icon: "h-9 w-9 rounded-lg",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ className, variant = "primary", size = "md", type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-medium transition-[background,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}
