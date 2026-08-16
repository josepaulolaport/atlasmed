import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

enum UserRoleName { admin, manager, rep, ops }

extension UserRoleNameX on UserRoleName {
  String get label {
    switch (this) {
      case UserRoleName.admin:
        return 'Administrador';
      case UserRoleName.manager:
        return 'Gerente';
      case UserRoleName.rep:
        return 'Representante';
      case UserRoleName.ops:
        return 'Operações';
    }
  }

  /// What the role lets someone do, in the app's own language.
  ///
  /// `roles.description` is seeded in English — "Field representative",
  /// "Territory manager" — and the role picker printed it verbatim under the
  /// Portuguese label, so a sheet titled "Alterar função" listed four English
  /// subtitles.
  String get description {
    switch (this) {
      case UserRoleName.admin:
        return 'Acesso total, incluindo usuários e configurações';
      case UserRoleName.manager:
        return 'Gerencia uma zona e os representantes dela';
      case UserRoleName.rep:
        return 'Atua em campo nos territórios atribuídos';
      case UserRoleName.ops:
        return 'Cuida de cadastros, pedidos e não conformidades';
    }
  }

  Color get color {
    switch (this) {
      case UserRoleName.admin:
        return const Color(0xFF8b5cf6);
      case UserRoleName.manager:
        return AppColors.navyBright;
      case UserRoleName.rep:
        return AppColors.green;
      case UserRoleName.ops:
        return AppColors.amber;
    }
  }
}
