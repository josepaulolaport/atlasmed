import 'package:flutter/material.dart';

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
        return const Color(0xFF16a373);
      case ClinicStatus.negotiation:
        return const Color(0xFFc6861b);
      case ClinicStatus.inactive:
        return const Color(0xFF6b7280);
      case ClinicStatus.rejected:
        return const Color(0xFFb84545);
    }
  }

  Color get bg {
    switch (this) {
      case ClinicStatus.active:
        return const Color(0xFFe6f7f0);
      case ClinicStatus.negotiation:
        return const Color(0xFFfef3d5);
      case ClinicStatus.inactive:
        return const Color(0xFFf3f4f6);
      case ClinicStatus.rejected:
        return const Color(0xFFfde8e8);
    }
  }
}
