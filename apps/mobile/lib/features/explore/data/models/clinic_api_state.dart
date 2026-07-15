// ── Clinic API state enum ────────────────────────────────────
enum ClinicApiState { registered, active, suspended, inactive }

extension ClinicApiStateX on ClinicApiState {
  String get label {
    switch (this) {
      case ClinicApiState.registered:
        return 'Registrado';
      case ClinicApiState.active:
        return 'Ativo';
      case ClinicApiState.suspended:
        return 'Suspenso';
      case ClinicApiState.inactive:
        return 'Inativo';
    }
  }

  String toJson() => name.toUpperCase();
}

ClinicApiState clinicApiStateFromJson(String json) {
  switch (json.toUpperCase()) {
    case 'REGISTERED':
      return ClinicApiState.registered;
    case 'ACTIVE':
      return ClinicApiState.active;
    case 'SUSPENDED':
      return ClinicApiState.suspended;
    case 'INACTIVE':
      return ClinicApiState.inactive;
    default:
      return ClinicApiState.active;
  }
}
