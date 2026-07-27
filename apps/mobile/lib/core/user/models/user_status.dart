import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

enum UserStatus { active, inactive, suspended, pending }

extension UserStatusX on UserStatus {
  String get label {
    switch (this) {
      case UserStatus.active:
        return 'Ativo';
      case UserStatus.inactive:
        return 'Inativo';
      case UserStatus.suspended:
        return 'Suspenso';
      case UserStatus.pending:
        return 'Pendente';
    }
  }

  Color get color {
    switch (this) {
      case UserStatus.active:
        return const AppColors.green;
      case UserStatus.inactive:
        return const AppColors.gray500;
      case UserStatus.suspended:
        return const AppColors.red;
      case UserStatus.pending:
        return const AppColors.amber;
    }
  }
}
