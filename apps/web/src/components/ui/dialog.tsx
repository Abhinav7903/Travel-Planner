"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-[1.4rem] border border-line bg-paper p-0 text-ink shadow-[0_30px_90px_rgba(37,39,33,.22)] backdrop:bg-[#252721]/35 backdrop:backdrop-blur-[2px]",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      <div className="flex items-start justify-between gap-6 border-b border-line px-6 py-5">
        <div>
          <h2 className="display text-[1.45rem]">{title}</h2>
          {description ? <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{description}</p> : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
          <X size={17} />
        </Button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-6 py-5 scroll-thin">{children}</div>
    </dialog>
  );
}
