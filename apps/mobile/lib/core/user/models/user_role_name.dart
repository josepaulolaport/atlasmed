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

  Color get color {
    switch (this) {
      case UserRoleName.admin:
        return const Color(0xFF8b5cf6);
      case UserRoleName.manager:
        return const AppColors.navyBright;
      case UserRoleName.rep:
        return const AppColors.green;
      case UserRoleName.ops:
        return const AppColors.amber;
    }
  }
}
