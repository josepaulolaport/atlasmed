import { z } from "zod";

/** `HH:MM`, 24-hour. Matches the `time` columns the linha defaults use. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Kept unrefined so both the full and the patch schema can derive from it.
 *
 * `.partial()` throws at *import time* on an object carrying refinements, which
 * would take down every route in this package — and TypeScript does not catch
 * it, so the refinement is applied to each derived schema instead of here.
 */
const userPreferencesShape = z
  .object({
    theme: z.enum(["system", "light", "dark"]).default("system"),
    pushNotificationsEnabled: z.boolean().default(true),
    emailNotificationsEnabled: z.boolean().default(true),
    smsNotificationsEnabled: z.boolean().default(false),
    /**
     * When this rep actually works — spec 0016 §15.5.5.
     *
     * `null` means *not set*, and the engine falls back to the linha default.
     * Deliberately nullable rather than defaulted: a rep who has never been
     * asked is not the same as one who chose 08:00, and only the first of those
     * should follow the linha when the linha changes.
     *
     * Each field falls back independently — a rep may care that they stop at
     * 16:00 without having an opinion about lunch.
     */
    workdayStart: z.string().regex(TIME_OF_DAY).nullable().default(null),
    workdayEnd: z.string().regex(TIME_OF_DAY).nullable().default(null),
  })
  .strict();

/**
 * Only fires when the rep has given both ends. A patch that sets one of them
 * alone is legitimate, and comparing it against an absent value would reject an
 * edit that is fine — the stored pair is re-validated on the full schema.
 */
const workdayOrdered = (p: {
  workdayStart?: string | null;
  workdayEnd?: string | null;
}): boolean =>
  p.workdayStart == null || p.workdayEnd == null || p.workdayEnd > p.workdayStart;

const workdayOrderIssue = {
  message: "workdayEnd must be after workdayStart",
  path: ["workdayEnd"],
};

/**
 * The keys this version knows about, for readers that have to cope with rows
 * written by an older one. See `parseMetadataPreferences`: reading stored JSON
 * must not fail because the app used to store more than it does now.
 */
export const userPreferencesShapeForReading = userPreferencesShape;

export const userPreferencesSchema = userPreferencesShape.refine(
  workdayOrdered,
  workdayOrderIssue,
);

export const updateUserPreferencesSchema = userPreferencesShape
  .partial()
  .refine(workdayOrdered, workdayOrderIssue);

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesInput = z.infer<
  typeof updateUserPreferencesSchema
>;
