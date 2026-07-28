import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// API `commercialStatus` values for facility list filters.
abstract final class CommercialStatusFilter {
  static const unregistered = 'UNREGISTERED';
  static const registered = 'REGISTERED';
  static const suspended = 'SUSPENDED';
  static const closed = 'CLOSED';

  static const values = [unregistered, registered, suspended, closed];

  static String label(String value) => switch (value) {
    unregistered => 'Pré-cadastro',
    registered => 'Operante',
    suspended => 'Suspensa',
    closed => 'Encerrada',
    _ => value,
  };

  static Color color(String value) => switch (value) {
    unregistered => AppColors.blueAccent,
    registered => AppColors.green,
    suspended => AppColors.amber,
    closed => AppColors.gray500,
    _ => AppColors.gray500,
  };

  static Color bg(String value) => switch (value) {
    unregistered => AppColors.blueLight,
    registered => AppColors.green50,
    suspended => AppColors.amber50,
    closed => AppColors.gray100,
    _ => AppColors.gray100,
  };
}
