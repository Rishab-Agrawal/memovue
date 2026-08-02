import type { EventType } from "@prisma/client";

/**
 * Single source of truth for how each event type personalises the guest join screen.
 *
 * `relation` decides what (if anything) we ask a guest beyond their name:
 *   - "sides"   → two named people; guest picks one or both, plus a free-text relation.
 *   - "honoree" → one named person; guest just says how they know them.
 *   - "none"    → name only. Colleagues and trip-mates already know each other.
 *
 * The host can always switch the relation question off entirely; they can never switch it
 * on for a "none" type, because there's no sensible question to ask.
 *
 * Deliberately no icons or emoji here. Emoji-as-iconography is a giveaway of generated
 * interfaces, and the words are perfectly legible on their own.
 */
export type RelationMode = "sides" | "honoree" | "none";

export interface EventTypeConfig {
  value: EventType;
  label: string;
  relation: RelationMode;
  /** Labels for the name inputs the host fills in at creation time. */
  nameFields?: { a: string; b?: string };
  /** Rendered on the guest join screen, with {a} / {b} / {name} interpolated. */
  relationPrompt?: string;
}

export const EVENT_TYPES: EventTypeConfig[] = [
  {
    value: "WEDDING",
    label: "Wedding",
    relation: "sides",
    nameFields: { a: "First partner's name", b: "Second partner's name" },
    relationPrompt: "Whose side are you here for?",
  },
  {
    value: "BIRTHDAY",
    label: "Birthday",
    relation: "honoree",
    nameFields: { a: "Whose birthday is it?" },
    relationPrompt: "How do you know {name}?",
  },
  {
    value: "ANNIVERSARY",
    label: "Anniversary",
    relation: "sides",
    nameFields: { a: "First partner's name", b: "Second partner's name" },
    relationPrompt: "Whose side are you here for?",
  },
  {
    value: "BABY_SHOWER",
    label: "Baby shower",
    relation: "honoree",
    nameFields: { a: "Who's the shower for?" },
    relationPrompt: "How do you know {name}?",
  },
  {
    value: "GRADUATION",
    label: "Graduation",
    relation: "honoree",
    nameFields: { a: "Who's graduating?" },
    relationPrompt: "How do you know {name}?",
  },
  { value: "PARTY", label: "Party", relation: "none" },
  { value: "OFFSITE", label: "Team offsite", relation: "none" },
  { value: "TRIP", label: "Trip", relation: "none" },
  { value: "FESTIVAL", label: "Festival", relation: "none" },
  { value: "OTHER", label: "Something else", relation: "none" },
];

export function eventTypeConfig(type: EventType): EventTypeConfig {
  return EVENT_TYPES.find((t) => t.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

/** Whether this event actually asks guests a relation question, honouring the host's toggle. */
export function asksRelation(type: EventType, askRelation: boolean): boolean {
  return askRelation && eventTypeConfig(type).relation !== "none";
}

export function relationPromptFor(
  type: EventType,
  names: { partnerA?: string | null; partnerB?: string | null; honoreeName?: string | null },
): string {
  const cfg = eventTypeConfig(type);
  if (!cfg.relationPrompt) return "";
  return cfg.relationPrompt
    .replace("{name}", names.honoreeName ?? "them")
    .replace("{a}", names.partnerA ?? "")
    .replace("{b}", names.partnerB ?? "");
}

export const REVEAL_OPTIONS = [
  { hours: 3, label: "3 hours" },
  { hours: 6, label: "6 hours" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "1 day" },
  { hours: 48, label: "2 days" },
  { hours: 72, label: "3 days" },
] as const;

export const GUEST_COUNT_OPTIONS = [15, 30, 60, 100, 200, 350, 500] as const;

export const MAX_PHOTOS_PER_GUEST = 25;
export const MIN_PHOTOS_PER_GUEST = 3;
