import { Elysia } from "elysia";
import { ForbiddenError, type AuthContext } from "@atlasmed/access";
import { defineAbilitiesFor } from "@atlasmed/access";
import type { Action, Subject } from "@atlasmed/access";

export const requirePermission = (action: Action, subject: Subject) => {
  return new Elysia({ name: `permission:${action}:${subject}` })
    .derive(({ auth }: any) => {
      if (!auth) {
        throw new ForbiddenError();
      }

      const ability = defineAbilitiesFor(auth.user.role.name);

      if (!ability.can(action, subject)) {
        throw new ForbiddenError();
      }

      return {};
    });
};
