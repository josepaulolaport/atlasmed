import 'package:flutter/material.dart';

// ── Clinic status ────────────────────────────────────────────
enum ClinicStatus { ativa, negociacao, inativa, nunca, rejeicao }

extension ClinicStatusX on ClinicStatus {
  String get label {
    switch (this) {
      case ClinicStatus.ativa:
        return 'Ativa';
      case ClinicStatus.negociacao:
        return 'Em negociação';
      case ClinicStatus.inativa:
        return 'Inativa';
      case ClinicStatus.nunca:
        return 'Nunca comprou';
      case ClinicStatus.rejeicao:
        return 'Rejeição';
    }
  }

  Color get color {
    switch (this) {
      case ClinicStatus.ativa:
        return const Color(0xFF16a373);
      case ClinicStatus.negociacao:
        return const Color(0xFFc6861b);
      case ClinicStatus.inativa:
        return const Color(0xFF6b7280);
      case ClinicStatus.nunca:
        return const Color(0xFF3b82f6);
      case ClinicStatus.rejeicao:
        return const Color(0xFFb84545);
    }
  }

  Color get bg {
    switch (this) {
      case ClinicStatus.ativa:
        return const Color(0xFFe6f7f0);
      case ClinicStatus.negociacao:
        return const Color(0xFFfef3d5);
      case ClinicStatus.inativa:
        return const Color(0xFFf3f4f6);
      case ClinicStatus.nunca:
        return const Color(0xFFeef4ff);
      case ClinicStatus.rejeicao:
        return const Color(0xFFfde8e8);
    }
  }
}
