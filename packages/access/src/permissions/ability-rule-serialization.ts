import type { AppAbility } from "./role.permissions";

export interface SerializedAbilityRule {
  action: string;
  subject: string;
  inverted?: true;
}

export function serializeAbilityRules(
  ability: AppAbility,
): SerializedAbilityRule[] {
  return ability.rules.flatMap((rule) => {
    // Conditions describe resource-scoped authorization. Exposing them without
    // their conditions would broaden the mobile type-level snapshot.
    if (rule.conditions) return [];

    return [
      {
        action: String(rule.action),
        subject: String(rule.subject),
        ...(rule.inverted ? { inverted: true as const } : {}),
      },
    ];
  });
}
