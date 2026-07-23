import 'package:flutter/material.dart';

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
    registered => const Color(0xFF3b82f6),
    active => const Color(0xFF16a373),
    suspended => const Color(0xFFc6861b),
    inactive => const Color(0xFF6b7280),
    _ => const Color(0xFF6b7280),
  };

  static Color bg(String value) => switch (value) {
    registered => const Color(0xFFeef4ff),
    active => const Color(0xFFe6f7f0),
    suspended => const Color(0xFFfef3d5),
    inactive => const Color(0xFFf3f4f6),
    _ => const Color(0xFFf3f4f6),
  };
}
