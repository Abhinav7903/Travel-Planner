"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Check,
  CircleDot,
  Copy,
  Crown,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import type { Invitation, ItineraryDay, Member, Role, Trip, TripGroup } from "@/lib/types";
import { browserApi } from "@/lib/client-api";
import { cn, errorMessage, formatDay, initials, roleLabel } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, Spinner } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, FormError, Input, Label, Select } from "@/components/ui/input";

const groupColors = ["#1f4d3d", "#b9714a", "#3f6c8e", "#8a6a3f", "#76628d", "#66765a", "#a14f68"];

type GroupForm = {
  name: string;
  color: string;
  member_ids: string[];
};

export function PeopleWorkspace({
  trip,
  initialMembers,
  initialGroups,
  initialInvitations,
  days,
  canInvite,
  canManageMembers,
  canManageGroups,
}: {
  trip: Trip;
  initialMembers: Member[];
  initialGroups: TripGroup[];
  initialInvitations: Invitation[];
  days: ItineraryDay[];
  canInvite: boolean;
  canManageMembers: boolean;
  canManageGroups: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [groups, setGroups] = useState(initialGroups);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TripGroup | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "editor" as "editor" | "viewer" });
  const [groupForm, setGroupForm] = useState<GroupForm>({ name: "", color: groupColors[0]!, member_ids: [] });
  const [busy, setBusy] = useState(false);
  const [memberBusy, setMemberBusy] = useState<string | null>(null);
  const [invitationBusy, setInvitationBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lastInvite, setLastInvite] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState("");

  const nameByID = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const pendingInvites = invitations.filter((invitation) => invitation.status === "pending");
  const pastInvites = invitations.filter((invitation) => invitation.status !== "pending");
  const groupStops = useMemo(() => {
    const counts = new Map<string, number>();
    days.forEach((day) => day.items.forEach((item) => {
      if (item.group_id) counts.set(item.group_id, (counts.get(item.group_id) ?? 0) + 1);
    }));
    return counts;
  }, [days]);
  const ungroupedStops = useMemo(
    () => days.reduce((sum, day) => sum + day.items.filter((item) => !item.group_id).length, 0),
    [days],
  );

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("Copy failed. Select the link and copy it manually.");
    }
  }

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const fields: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email.trim())) fields.email = "Enter a valid email address.";
    setFieldErrors(fields);
    if (Object.keys(fields).length) return;
    setBusy(true);
    setError("");
    try {
      const invitation = await browserApi<Invitation>(`/api/v1/trips/${trip.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: inviteForm.email.trim(), role: inviteForm.role }),
      });
      setInvitations((current) => [invitation, ...current]);
      setLastInvite(invitation);
      setInviteForm({ email: "", role: "editor" });
      setInviteOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend(invitation: Invitation) {
    if (invitationBusy) return;
    setInvitationBusy(invitation.id);
    setError("");
    try {
      const updated = await browserApi<Invitation>(`/api/v1/trips/${trip.id}/invitations/${invitation.id}/resend`, {
        method: "POST",
        body: "{}",
      });
      setInvitations((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setLastInvite(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setInvitationBusy(null);
    }
  }

  async function revoke(invitation: Invitation) {
    if (invitationBusy) return;
    if (!window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
    setInvitationBusy(invitation.id);
    setError("");
    try {
      await browserApi(`/api/v1/trips/${trip.id}/invitations/${invitation.id}`, { method: "DELETE" });
      setInvitations((current) => current.map((candidate) => candidate.id === invitation.id ? { ...candidate, status: "revoked" } : candidate));
      if (lastInvite?.id === invitation.id) setLastInvite(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setInvitationBusy(null);
    }
  }

  async function changeRole(member: Member, role: Role) {
    if (!canManageMembers || member.role === "owner" || memberBusy) return;
    setMemberBusy(member.user_id);
    setError("");
    try {
      await browserApi(`/api/v1/trips/${trip.id}/members/${member.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMembers((current) => current.map((candidate) => candidate.user_id === member.user_id ? { ...candidate, role } : candidate));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setMemberBusy(null);
    }
  }

  async function removeMember(member: Member) {
    if (!canManageMembers || member.role === "owner" || memberBusy) return;
    if (!window.confirm(`Remove ${member.display_name} from this trip?`)) return;
    setMemberBusy(member.user_id);
    setError("");
    try {
      await browserApi(`/api/v1/trips/${trip.id}/members/${member.user_id}`, { method: "DELETE" });
      setMembers((current) => current.filter((candidate) => candidate.user_id !== member.user_id));
      setGroups((current) => current.map((group) => ({
        ...group,
        member_ids: group.member_ids.filter((id) => id !== member.user_id),
      })));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setMemberBusy(null);
    }
  }

  function openGroup(group?: TripGroup) {
    setEditingGroup(group ?? null);
    setGroupForm({
      name: group?.name ?? "",
      color: group?.color ?? groupColors[groups.length % groupColors.length]!,
      member_ids: group?.member_ids ?? [],
    });
    setFieldErrors({});
    setError("");
    setGroupOpen(true);
  }

  async function saveGroup(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const fields: Record<string, string> = {};
    if (!groupForm.name.trim()) fields.name = "Name the group.";
    if (!/^#[0-9a-fA-F]{6}$/.test(groupForm.color)) fields.color = "Choose a hex colour.";
    setFieldErrors(fields);
    if (Object.keys(fields).length) return;
    setBusy(true);
    setError("");
    try {
      const group = await browserApi<TripGroup>(
        editingGroup
          ? `/api/v1/trips/${trip.id}/groups/${editingGroup.id}`
          : `/api/v1/trips/${trip.id}/groups`,
        {
          method: editingGroup ? "PATCH" : "POST",
          body: JSON.stringify({
            name: groupForm.name.trim(),
            color: groupForm.color,
            member_ids: groupForm.member_ids,
            version: editingGroup?.version ?? 0,
          }),
        },
      );
      setGroups((current) => editingGroup
        ? current.map((candidate) => candidate.id === group.id ? group : candidate)
        : [...current, group]);
      setGroupOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup(group: TripGroup) {
    if (!canManageGroups) return;
    if (!window.confirm(`Delete the group “${group.name}”? Its itinerary items stay, but the group filter disappears.`)) return;
    setError("");
    try {
      await browserApi(`/api/v1/trips/${trip.id}/groups/${group.id}`, { method: "DELETE" });
      setGroups((current) => current.filter((candidate) => candidate.id !== group.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Travellers & groups</p>
          <h2 className="display mt-1.5 text-[2rem] leading-none">The people on the path.</h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-soft">
            Invite by email, set what each person can change, and branch a day when the group splits.
          </p>
        </div>
        {canInvite ? (
          <Button onClick={() => { setError(""); setFieldErrors({}); setInviteOpen(true); }}>
            <UserPlus size={15} /> Invite traveller
          </Button>
        ) : null}
      </div>

      {error && !inviteOpen && !groupOpen ? <div className="mt-4"><FormError>{error}</FormError></div> : null}

      {lastInvite?.invite_url ? (
        <div className="mt-5 rounded-2xl border border-[#cddacc] bg-forest-soft/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-forest">
                <Check size={13} /> Invitation ready for {lastInvite.email}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-forest/75">
                {lastInvite.warning || `The link expires ${formatDay(lastInvite.expires_at.slice(0, 10), "MMM d, yyyy")}.`}
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-[#cddacc] bg-paper px-2.5 py-1.5 text-[10.5px] text-ink-soft sm:max-w-[340px]">
                {lastInvite.invite_url}
              </code>
              <Button size="sm" variant="secondary" onClick={() => void copy(lastInvite.invite_url!)}>
                {copied === lastInvite.invite_url ? <Check size={12} /> : <Copy size={12} />}
                {copied === lastInvite.invite_url ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-line bg-paper">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
            <div>
              <h3 className="text-[13.5px] font-semibold">Members</h3>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">One owner, editors and viewers</p>
            </div>
            <Badge tone="sand">{members.length}</Badge>
          </div>
          <ul className="divide-y divide-line">
            {members.map((member) => (
              <li key={member.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                <Avatar name={member.display_name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
                    {member.display_name}
                    {member.role === "owner" ? <Crown size={12} className="text-[#9b7b3e]" /> : null}
                  </p>
                  <p className="truncate text-[11.5px] text-ink-faint">{member.email}</p>
                </div>
                {canManageMembers && member.role !== "owner" ? (
                  <div className="flex items-center gap-1.5">
                    <Select
                      aria-label={`Role for ${member.display_name}`}
                      value={member.role}
                      disabled={memberBusy === member.user_id}
                      onChange={(event) => void changeRole(member, event.target.value as Role)}
                      className="h-8 w-[100px] text-[11.5px]"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[#9a4a2b]"
                      aria-label={`Remove ${member.display_name}`}
                      disabled={memberBusy === member.user_id}
                      onClick={() => void removeMember(member)}
                    >
                      {memberBusy === member.user_id ? <Spinner /> : <UserMinus size={14} />}
                    </Button>
                  </div>
                ) : (
                  <Badge tone={member.role === "owner" ? "forest" : "neutral"}>
                    {member.role === "owner" ? <ShieldCheck size={10} /> : null}
                    {roleLabel[member.role] ?? member.role}
                  </Badge>
                )}
              </li>
            ))}
          </ul>

          {canInvite ? (
            <div className="border-t border-line bg-[#fbf8f1] px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold"><Mail size={13} /> Invitations</h3>
                  <p className="mt-0.5 text-[11px] text-ink-faint">Only the invited email can accept. Links are one-time and expire.</p>
                </div>
                <Badge tone="neutral">{pendingInvites.length} pending</Badge>
              </div>
              {invitations.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-line-strong px-3.5 py-4 text-[11.5px] text-ink-faint">
                  No invitations sent yet.
                </p>
              ) : (
                <ul className="mt-2.5 divide-y divide-line/70">
                  {[...pendingInvites, ...pastInvites].map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap items-center gap-2 py-2.5">
                      <span className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        invitation.status === "pending" ? "bg-[#b9714a]" : invitation.status === "accepted" ? "bg-forest" : "bg-line-strong",
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] text-ink">{invitation.email}</p>
                        <p className="text-[10.5px] text-ink-faint">
                          {roleLabel[invitation.role]} · {invitation.status}
                          {invitation.status === "pending" ? ` · expires ${formatDay(invitation.expires_at.slice(0, 10), "MMM d")}` : ""}
                        </p>
                      </div>
                      {invitation.status === "pending" ? (
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Resend invitation to ${invitation.email}`}
                            disabled={invitationBusy === invitation.id}
                            onClick={() => void resend(invitation)}
                          >
                            {invitationBusy === invitation.id ? <Spinner /> : <RefreshCw size={12} />}
                          </Button>
                          {invitation.invite_url ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Copy invite link" onClick={() => void copy(invitation.invite_url!)}>
                              {copied === invitation.invite_url ? <Check size={12} /> : <Copy size={12} />}
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-[#9a4a2b]" aria-label={`Revoke invitation to ${invitation.email}`} disabled={invitationBusy === invitation.id} onClick={() => void revoke(invitation)}>
                            <Ban size={12} />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold"><Route size={14} /> Traveller groups</h3>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-faint">Branch days by group and compare their stops.</p>
              </div>
              {canManageGroups ? (
                <Button variant="secondary" size="sm" onClick={() => openGroup()}>
                  <Plus size={12} /> Group
                </Button>
              ) : null}
            </div>

            {groups.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={<Users size={18} />}
                  title="No groups yet"
                  description="Create a group like “Temples” or “Food & city” to split a day without losing the shared plan."
                  action={canManageGroups ? <Button size="sm" variant="secondary" onClick={() => openGroup()}><Plus size={13} /> Create group</Button> : undefined}
                />
              </div>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {groups.map((group) => (
                  <li key={group.id} className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white/70" style={{ background: group.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center justify-between gap-2 text-[12.5px] font-semibold">
                          <span className="truncate">{group.name}</span>
                          <span className="shrink-0 text-[10px] font-normal text-ink-faint">{groupStops.get(group.id) ?? 0} group stops</span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {group.member_ids.length ? group.member_ids.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-sand px-1.5 py-0.5 text-[10px] text-ink-soft">
                              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-paper text-[7px] font-semibold">
                                {initials(nameByID.get(id) ?? "?")}
                              </span>
                              {nameByID.get(id) ?? "Former member"}
                            </span>
                          )) : <span className="text-[10.5px] text-ink-faint">No members assigned</span>}
                        </div>
                      </div>
                      {canManageGroups ? (
                        <div className="flex shrink-0 gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Edit ${group.name}`} onClick={() => openGroup(group)}>
                            <Pencil size={10} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-[#9a4a2b]" aria-label={`Delete ${group.name}`} onClick={() => void deleteGroup(group)}>
                            <Trash2 size={10} />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {groups.length ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f7f4ec] px-3 py-2.5 text-[11px] leading-relaxed text-ink-soft">
                <CircleDot size={12} className="shrink-0 text-ink-faint" />
                {ungroupedStops} shared {ungroupedStops === 1 ? "stop" : "stops"} belong to everyone. Filter by group in Plan to compare branches.
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
            <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold"><ShieldCheck size={14} /> What roles can do</h3>
            <dl className="mt-3 space-y-2.5 text-[11.5px] leading-relaxed">
              <div className="flex gap-3">
                <dt className="w-14 shrink-0 font-semibold text-ink">Viewer</dt>
                <dd className="text-ink-soft">Read the graph, notes, map, and money. No edits.</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-14 shrink-0 font-semibold text-ink">Editor</dt>
                <dd className="text-ink-soft">Plan, invite, manage groups, notes, and expenses.</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-14 shrink-0 font-semibold text-ink">Owner</dt>
                <dd className="text-ink-soft">Everything, including trip settings and member roles.</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <Dialog open={inviteOpen} onClose={() => { if (!busy) setInviteOpen(false); }} title="Invite a traveller" description="They will sign in with this email before the trip opens.">
        <form onSubmit={sendInvite} className="space-y-4">
          {error ? <FormError>{error}</FormError> : null}
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" autoFocus value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="friend@example.com" />
            <FieldError>{fieldErrors.email}</FieldError>
          </div>
          <div>
            <Label htmlFor="invite-role">Permission</Label>
            <Select id="invite-role" value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value as "editor" | "viewer" }))}>
              <option value="editor">Editor — can plan and spend</option>
              <option value="viewer">Viewer — can only read</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? <Spinner /> : <Mail size={14} />} Send invitation</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={groupOpen}
        onClose={() => { if (!busy) setGroupOpen(false); }}
        title={editingGroup ? "Edit group" : "Create a group"}
        description="Assign members now, then use the group when adding itinerary items."
      >
        <form onSubmit={saveGroup} className="space-y-4">
          {error ? <FormError>{error}</FormError> : null}
          <div>
            <Label htmlFor="group-name">Name</Label>
            <Input id="group-name" autoFocus value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} placeholder="Temples & gardens" />
            <FieldError>{fieldErrors.name}</FieldError>
          </div>
          <div>
            <Label htmlFor="group-color">Colour</Label>
            <div className="flex flex-wrap items-center gap-2">
              {groupColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use colour ${color}`}
                  aria-pressed={groupForm.color === color}
                  onClick={() => setGroupForm((current) => ({ ...current, color }))}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform hover:scale-105",
                    groupForm.color === color ? "border-ink" : "border-transparent",
                  )}
                  style={{ background: color }}
                />
              ))}
              <input
                id="group-color"
                aria-label="Custom hex colour"
                value={groupForm.color}
                onChange={(event) => setGroupForm((current) => ({ ...current, color: event.target.value }))}
                className="ml-1 h-8 w-[92px] rounded-lg border border-line-strong bg-paper px-2 font-mono text-[11px] focus:border-forest focus:outline-none"
              />
            </div>
            <FieldError>{fieldErrors.color}</FieldError>
          </div>
          <div>
            <Label>Members <span className="font-normal text-ink-faint">optional</span></Label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {members.map((member) => {
                const selected = groupForm.member_ids.includes(member.user_id);
                return (
                  <button
                    key={member.user_id}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() => setGroupForm((current) => ({
                      ...current,
                      member_ids: selected
                        ? current.member_ids.filter((id) => id !== member.user_id)
                        : [...current.member_ids, member.user_id],
                    }))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      selected ? "border-[#c7d4c7] bg-forest-soft/50" : "border-line hover:bg-[#faf7f0]",
                    )}
                  >
                    <span className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      selected ? "border-forest bg-forest text-white" : "border-line-strong",
                    )}>
                      {selected ? <Check size={10} /> : null}
                    </span>
                    <Avatar name={member.display_name} size="xs" />
                    <span className="truncate text-[11.5px]">{member.display_name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setGroupOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? <Spinner /> : <Check size={14} />} {editingGroup ? "Save group" : "Create group"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
