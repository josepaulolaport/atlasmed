import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

enum CommercialStatus { registered, active, suspended, inactive }

extension CommercialStatusX on CommercialStatus {
  String get apiValue => switch (this) {
    CommercialStatus.registered => 'REGISTERED',
    CommercialStatus.active => 'ACTIVE',
    CommercialStatus.suspended => 'SUSPENDED',
    CommercialStatus.inactive => 'INACTIVE',
  };

  String get label => switch (this) {
    CommercialStatus.registered => 'Cadastrado',
    CommercialStatus.active => 'Ativo',
    CommercialStatus.suspended => 'Suspenso',
    CommercialStatus.inactive => 'Inativo',
  };
}

CommercialStatus? commercialStatusFromApi(Object? value) => switch (value) {
  'REGISTERED' => CommercialStatus.registered,
  'ACTIVE' => CommercialStatus.active,
  'SUSPENDED' => CommercialStatus.suspended,
  'INACTIVE' => CommercialStatus.inactive,
  _ => null,
};

// ── Clinic status ────────────────────────────────────────────
enum ClinicStatus { active, negotiation, inactive, rejected }

extension ClinicStatusX on ClinicStatus {
  String get label {
    switch (this) {
      case ClinicStatus.active:
        return 'Ativa';
      case ClinicStatus.negotiation:
        return 'Em negociação';
      case ClinicStatus.inactive:
        return 'Inativa';
      case ClinicStatus.rejected:
        return 'Rejeição';
    }
  }

  Color get color {
    switch (this) {
      case ClinicStatus.active:
        return const AppColors.green;
      case ClinicStatus.negotiation:
        return const AppColors.amber;
      case ClinicStatus.inactive:
        return const AppColors.gray500;
      case ClinicStatus.rejected:
        return const AppColors.red;
    }
  }

  Color get bg {
    switch (this) {
      case ClinicStatus.active:
        return const Color(0xFFe6f7f0);
      case ClinicStatus.negotiation:
        return const Color(0xFFfef3d5);
      case ClinicStatus.inactive:
        return const AppColors.gray100;
      case ClinicStatus.rejected:
        return const Color(0xFFfde8e8);
    }
  }
}
