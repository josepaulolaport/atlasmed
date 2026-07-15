import 'package:flutter/material.dart';

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
        return const Color(0xFF16a373);
      case UserStatus.inactive:
        return const Color(0xFF6b7280);
      case UserStatus.suspended:
        return const Color(0xFFb84545);
      case UserStatus.pending:
        return const Color(0xFFc6861b);
    }
  }
}
