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
    registered => const AppColors.blueAccent,
    active => const AppColors.green,
    suspended => const AppColors.amber,
    inactive => const AppColors.gray500,
    _ => const AppColors.gray500,
  };

  static Color bg(String value) => switch (value) {
    registered => const Color(0xFFeef4ff),
    active => const Color(0xFFe6f7f0),
    suspended => const Color(0xFFfef3d5),
    inactive => const AppColors.gray100,
    _ => const AppColors.gray100,
  };
}
