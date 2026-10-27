"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, Check, Eye, FileText, Loader2, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import type { Note, Trip } from "@/lib/types";
import { browserApi, BrowserApiError } from "@/lib/client-api";
import { cn, errorMessage, formatDay } from "@/lib/utils";
import { Button, Spinner } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function NotesWorkspace({ trip, initialNotes, canEdit }: { trip: Trip; initialNotes: Note[]; canEdit: boolean }) {
  const [notes, setNotes] = useState(initialNotes);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body_markdown: "", pinned: false });
  const [preview, setPreview] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selectedRef = useRef<string | null>(null);
  const notesRef = useRef(notes);
  const saveSeq = useRef(0);

  const selected = notes.find((note) => note.id === selectedID);

  useEffect(() => {
    selectedRef.current = selectedID;
  }, [selectedID]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    if (revision === 0 || !selectedID || !canEdit) return;
    const note = notesRef.current.find((candidate) => candidate.id === selectedID);
    if (!note) return;
    const targetID = selectedID;
    const sequence = ++saveSeq.current;
    setSaveState("dirty");
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      setError("");
      try {
        const updated = await browserApi<Note>(`/api/v1/trips/${trip.id}/notes/${targetID}`, {
          method: "PATCH",
          body: JSON.stringify({ ...draft, version: note.version }),
        });
        setNotes((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
        if (selectedRef.current === targetID && saveSeq.current === sequence) {
          setSaveState("saved");
          setSavedAt(new Date());
        }
      } catch (err) {
        if (selectedRef.current === targetID) {
          setSaveState("error");
          setError(
            err instanceof BrowserApiError && err.status === 409
              ? "This note changed somewhere else. Reload it before saving again."
              : errorMessage(err),
          );
        }
      }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [revision, draft, selectedID, canEdit, trip.id]);

  function select(note: Note) {
    setSelectedID(note.id);
    setDraft({ title: note.title, body_markdown: note.body_markdown, pinned: note.pinned });
    setPreview(false);
    setRevision(0);
    setSaveState("idle");
    setSavedAt(null);
    setError("");
    setConfirmDelete(false);
  }

  function edit(patch: Partial<typeof draft>) {
    if (!canEdit) return;
    setDraft((current) => ({ ...current, ...patch }));
    setRevision((value) => value + 1);
  }

  async function createNote() {
    if (!canEdit || creating) return;
    setCreating(true);
    setError("");
    try {
      const created = await browserApi<Note>(`/api/v1/trips/${trip.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ title: "Untitled note", body_markdown: "", pinned: false }),
      });
      setNotes((current) => [created, ...current]);
      select(created);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function deleteNote() {
    if (!selected || !canEdit) return;
    try {
      await browserApi(`/api/v1/trips/${trip.id}/notes/${selected.id}?version=${selected.version}`, { method: "DELETE" });
      setNotes((current) => current.filter((note) => note.id !== selected.id));
      setSelectedID(null);
      setDraft({ title: "", body_markdown: "", pinned: false });
      setConfirmDelete(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function reloadNote() {
    if (!selected) return;
    try {
      const updated = await browserApi<Note>(`/api/v1/trips/${trip.id}/notes/${selected.id}`);
      setNotes((current) => current.map((note) => note.id === updated.id ? updated : note));
      select(updated);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Shared notebook</p>
          <h2 className="display mt-1.5 text-[1.9rem] leading-none">Notes for the road.</h2>
          <p className="mt-2 text-[12.5px] text-ink-soft">Markdown, autosaved. Raw HTML stays off.</p>
        </div>
        {canEdit ? (
          <Button onClick={() => void createNote()} disabled={creating}>
            {creating ? <Spinner /> : <Plus size={15} />} New note
          </Button>
        ) : null}
      </div>

      {error && !selected ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#e2c9bc] bg-[#fbf1eb] px-3.5 py-3 text-[12px] text-[#8f4529]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      ) : null}

      {notes.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<FileText size={19} />}
            title="No notes yet"
            description="Collect the addresses, packing thoughts, reservations and small reminders that don't belong on the schedule."
            action={canEdit ? <Button onClick={() => void createNote()} disabled={creating}><Plus size={14} /> Write the first note</Button> : undefined}
          />
        </div>
      ) : (
        <div className="mt-5 grid overflow-hidden rounded-2xl border border-line bg-paper lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-b border-line bg-[#f9f6ef] lg:border-b-0 lg:border-r">
            <div className="scroll-thin max-h-[260px] overflow-y-auto lg:max-h-[calc(100vh-240px)]">
              {sorted.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => select(note)}
                  className={cn(
                    "block w-full border-b border-line px-4 py-3.5 text-left transition-colors last:border-b-0",
                    selectedID === note.id ? "bg-paper" : "hover:bg-[#f3eee3]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {note.pinned ? <Pin size={10} className="shrink-0 fill-forest text-forest" /> : null}
                    <span className="truncate text-[12.5px] font-semibold">{note.title || "Untitled note"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-ink-soft">
                    {note.body_markdown.replace(/[#*_>`-]/g, "").slice(0, 110) || "Empty note"}
                  </p>
                  <p className="mt-1.5 text-[9px] text-ink-faint">
                    {note.updated_by_name} · {formatDay(note.updated_at.slice(0, 10), "MMM d")}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          {selected ? (
            <div className="flex min-h-[520px] min-w-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreview(false)}
                    className={cn("rounded-md px-2.5 py-1 text-[11.5px] font-medium", !preview ? "bg-[#ece7dc] text-ink" : "text-ink-soft")}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview(true)}
                    className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium", preview ? "bg-[#ece7dc] text-ink" : "text-ink-soft")}
                  >
                    <Eye size={12} /> Preview
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <SaveIndicator state={saveState} savedAt={savedAt} />
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={() => edit({ pinned: !draft.pinned })}
                        className={cn("rounded-md p-1.5 transition-colors hover:bg-[#ece7dc]", draft.pinned ? "text-forest" : "text-ink-faint")}
                        aria-label={draft.pinned ? "Unpin note" : "Pin note"}
                        title={draft.pinned ? "Unpin note" : "Pin note"}
                      >
                        {draft.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirmDelete) void deleteNote();
                          else setConfirmDelete(true);
                        }}
                        className={cn("rounded-md p-1.5 transition-colors hover:bg-[#f5e9e0]", confirmDelete ? "text-[#8f4529]" : "text-ink-faint")}
                        aria-label={confirmDelete ? "Confirm delete note" : "Delete note"}
                        title={confirmDelete ? "Click again to delete" : "Delete note"}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {error ? (
                <div className="flex items-center justify-between gap-3 border-b border-[#e2c9bc] bg-[#fbf1eb] px-4 py-2 text-[11.5px] text-[#8f4529]">
                  <span>{error}</span>
                  {error.includes("changed") ? (
                    <button type="button" onClick={() => void reloadNote()} className="shrink-0 font-semibold underline">Reload</button>
                  ) : (
                    <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={13} /></button>
                  )}
                </div>
              ) : null}

              <div className="flex flex-1 flex-col px-4 py-4 sm:px-6">
                <Input
                  value={draft.title}
                  disabled={!canEdit}
                  maxLength={160}
                  onChange={(event) => edit({ title: event.target.value })}
                  placeholder="Note title"
                  className="h-auto border-0 bg-transparent px-0 text-[1.5rem] font-semibold shadow-none focus:ring-0"
                  aria-label="Note title"
                />
                {preview ? (
                  <div className="markdown mt-3 min-h-[360px] flex-1">
                    {draft.body_markdown.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                        {draft.body_markdown}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-[12px] italic text-ink-faint">Nothing to preview yet.</p>
                    )}
                  </div>
                ) : (
                  <Textarea
                    value={draft.body_markdown}
                    disabled={!canEdit}
                    onChange={(event) => edit({ body_markdown: event.target.value })}
                    placeholder="Markdown supported. Addresses, reservations, things not to forget…"
                    className="mt-2 min-h-[360px] flex-1 resize-none border-0 bg-transparent px-0 text-[13.5px] leading-[1.75] focus:ring-0"
                    aria-label="Note body in Markdown"
                  />
                )}
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[10px] text-ink-faint">
                  <span className="flex items-center gap-2">
                    <Avatar name={selected.author_name} id={selected.author_name} size="xs" />
                    Started by {selected.author_name}
                  </span>
                  <span>Markdown · raw HTML disabled</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
              <div>
                <FileText size={20} className="mx-auto text-ink-faint" />
                <p className="mt-3 text-[13px] font-medium">Choose a note</p>
                <p className="mt-1 text-[11.5px] text-ink-faint">Or write something new for the trip.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: Date | null }) {
  if (state === "saving" || state === "dirty") {
    return (
      <span className="flex items-center gap-1.5 text-[10.5px] text-ink-faint">
        <Loader2 size={11} className="animate-spin" /> {state === "saving" ? "Saving" : "Unsaved"}
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[10.5px] text-forest">
        <Check size={11} /> Saved{savedAt ? ` ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[10.5px] text-[#8f4529]">
        <AlertCircle size={11} /> Not saved
      </span>
    );
  }
  return <span className="text-[10.5px] text-ink-faint">Autosave on</span>;
}
