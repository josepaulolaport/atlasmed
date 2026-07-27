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
        return AppColors.green;
      case ClinicStatus.negotiation:
        return AppColors.amber;
      case ClinicStatus.inactive:
        return AppColors.gray500;
      case ClinicStatus.rejected:
        return AppColors.red;
    }
  }

  Color get bg {
    switch (this) {
      case ClinicStatus.active:
        return AppColors.green50;
      case ClinicStatus.negotiation:
        return AppColors.amber50;
      case ClinicStatus.inactive:
        return AppColors.gray100;
      case ClinicStatus.rejected:
        return AppColors.red50;
    }
  }
}
