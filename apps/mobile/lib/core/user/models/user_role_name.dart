import 'package:flutter/material.dart';

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
        return const Color(0xFF1e40af);
      case UserRoleName.rep:
        return const Color(0xFF16a373);
      case UserRoleName.ops:
        return const Color(0xFFc6861b);
    }
  }
}
