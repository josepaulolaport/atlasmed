import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// API `commercialStatus` values for facility list filters.
abstract final class CommercialStatusFilter {
  static const registered = 'REGISTERED';
  static const active = 'ACTIVE';
  static const suspended = 'SUSPENDED';
  static const inactive = 'INACTIVE';

  static const values = [registered, active, suspended, inactive];

  static String label(String value) => switch (value) {
    registered => 'Cadastrada',
    active => 'Ativa',
    suspended => 'Suspensa',
    inactive => 'Inativa',
    _ => value,
  };

  static Color color(String value) => switch (value) {
    registered => AppColors.blueAccent,
    active => AppColors.green,
    suspended => AppColors.amber,
    inactive => AppColors.gray500,
    _ => AppColors.gray500,
  };

  static Color bg(String value) => switch (value) {
    registered => AppColors.blueLight,
    active => AppColors.green50,
    suspended => AppColors.amber50,
    inactive => AppColors.gray100,
    _ => AppColors.gray100,
  };
}
