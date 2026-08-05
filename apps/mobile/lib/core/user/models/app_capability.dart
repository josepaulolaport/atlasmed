enum AppCapability {
  agendaRead,
  agendaCreate,
  agendaUpdate,
  agendaDelete,
  catalogRead,
  catalogManage,
  cadastroRead,
  cadastroReview,
  fieldSuggestionRead,
  fieldSuggestionReview,
  facilityRead,
  facilityCreate,
  facilityUpdate,
  facilityDelete,
  professionalRead,
  professionalUpdate,
  territoryRead,
  territoryCreate,
  territoryUpdate,
  territoryDelete,
  userRead,
  userManage,
  userLifecycle,
}

extension AppCapabilityX on AppCapability {
  String get wireName => switch (this) {
    AppCapability.agendaRead => 'agenda.read',
    AppCapability.agendaCreate => 'agenda.create',
    AppCapability.agendaUpdate => 'agenda.update',
    AppCapability.agendaDelete => 'agenda.delete',
    AppCapability.catalogRead => 'catalog.read',
    AppCapability.catalogManage => 'catalog.manage',
    AppCapability.cadastroRead => 'cadastro.read',
    AppCapability.cadastroReview => 'cadastro.review',
    AppCapability.fieldSuggestionRead => 'field-suggestion.read',
    AppCapability.fieldSuggestionReview => 'field-suggestion.review',
    AppCapability.facilityRead => 'facility.read',
    AppCapability.facilityCreate => 'facility.create',
    AppCapability.facilityUpdate => 'facility.update',
    AppCapability.facilityDelete => 'facility.delete',
    AppCapability.professionalRead => 'professional.read',
    AppCapability.professionalUpdate => 'professional.update',
    AppCapability.territoryRead => 'territory.read',
    AppCapability.territoryCreate => 'territory.create',
    AppCapability.territoryUpdate => 'territory.update',
    AppCapability.territoryDelete => 'territory.delete',
    AppCapability.userRead => 'user.read',
    AppCapability.userManage => 'user.manage',
    AppCapability.userLifecycle => 'user.lifecycle',
  };

  static AppCapability? tryParse(String value) {
    for (final capability in AppCapability.values) {
      if (capability.wireName == value) return capability;
    }
    return null;
  }
}
