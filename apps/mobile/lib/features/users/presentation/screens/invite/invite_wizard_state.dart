import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';

enum InviteWizardStepKind { identity, zones, patches, review }

class InviteWizardStep {
  const InviteWizardStep({
    required this.kind,
    required this.title,
    required this.subtitle,
  });

  final InviteWizardStepKind kind;
  final String title;
  final String subtitle;
}

/// Builds the dynamic step list from the selected invitee role.
///
/// - ADMIN / OPS: identity → review
/// - MANAGER: identity → zones (empty) → review
/// - REP: identity → zones (parent manager zone) → patches → review
List<InviteWizardStep> buildInviteWizardSteps(UserRole? role) {
  final steps = <InviteWizardStep>[
    const InviteWizardStep(
      kind: InviteWizardStepKind.identity,
      title: 'Dados e função',
      subtitle: 'Quem será convidado, papel e linhas.',
    ),
  ];

  if (role == null) {
    steps.add(
      const InviteWizardStep(
        kind: InviteWizardStepKind.review,
        title: 'Revisão',
        subtitle: 'Confira e envie o convite.',
      ),
    );
    return steps;
  }

  switch (role.name) {
    case UserRoleName.manager:
      steps.add(
        const InviteWizardStep(
          kind: InviteWizardStepKind.zones,
          title: 'Zonas do gerente',
          subtitle: 'Escolha zonas vazias por linha.',
        ),
      );
    case UserRoleName.rep:
      steps.add(
        const InviteWizardStep(
          kind: InviteWizardStepKind.zones,
          title: 'Zona do gerente',
          subtitle: 'Uma zona por linha comercial.',
        ),
      );
      steps.add(
        const InviteWizardStep(
          kind: InviteWizardStepKind.patches,
          title: 'Áreas de atuação',
          subtitle: 'Escolha patches livres ou desenhe uma nova.',
        ),
      );
    case UserRoleName.admin:
    case UserRoleName.ops:
      break;
  }

  steps.add(
    const InviteWizardStep(
      kind: InviteWizardStepKind.review,
      title: 'Revisão',
      subtitle: 'Confira e envie o convite.',
    ),
  );

  return steps;
}
