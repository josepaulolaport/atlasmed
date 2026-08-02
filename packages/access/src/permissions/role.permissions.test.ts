import { describe, expect, it } from "bun:test";
import { Role } from "../enums/role.enum";
import { Subjects, type Subject } from "../subjects/subjects";
import { defineAbilitiesFor, type Action } from "./role.permissions";

const mutations: Action[] = ["create", "update", "delete"];
const schedulingSubjects: Subject[] = [Subjects.CALENDAR, Subjects.INTERACTION];

describe("calendar and interaction role permissions", () => {
  it("exports calendar and interaction subjects", () => {
    expect(Subjects.CALENDAR).toBe("CALENDAR");
    expect(Subjects.INTERACTION).toBe("INTERACTION");
  });

  it("allows ADMIN to manage both subjects", () => {
    const ability = defineAbilitiesFor(Role.ADMIN);

    for (const subject of schedulingSubjects) {
      expect(ability.can("manage", subject)).toBe(true);
    }
  });

  it("allows MANAGER to read both subjects without mutation access", () => {
    const ability = defineAbilitiesFor(Role.MANAGER);

    for (const subject of schedulingSubjects) {
      expect(ability.can("read", subject)).toBe(true);
      for (const action of mutations) {
        expect(ability.can(action, subject)).toBe(false);
      }
    }
  });

  it("allows REP to create, read, update, and delete both subjects", () => {
    const ability = defineAbilitiesFor(Role.REP);
    const actions: Action[] = ["create", "read", "update", "delete"];

    for (const subject of schedulingSubjects) {
      for (const action of actions) {
        expect(ability.can(action, subject)).toBe(true);
      }
    }
  });

  it("denies OPS all permissions for both subjects", () => {
    const ability = defineAbilitiesFor(Role.OPS);
    const actions: Action[] = ["create", "read", "update", "delete", "manage"];

    for (const subject of schedulingSubjects) {
      for (const action of actions) {
        expect(ability.can(action, subject)).toBe(false);
      }
    }
  });
});
