enum CapabilityResource {
  agenda,
  catalog,
  cadastro,
  fieldSuggestion,
  facility,
  professional,
  territory,
  user,
}

enum CapabilityAction {
  read,
  create,
  update,
  delete,
  manage,
  review,
  lifecycle,
}

extension CapabilityResourceX on CapabilityResource {
  String get wireName => switch (this) {
    CapabilityResource.agenda => 'agenda',
    CapabilityResource.catalog => 'catalog',
    CapabilityResource.cadastro => 'cadastro',
    CapabilityResource.fieldSuggestion => 'field-suggestion',
    CapabilityResource.facility => 'facility',
    CapabilityResource.professional => 'professional',
    CapabilityResource.territory => 'territory',
    CapabilityResource.user => 'user',
  };

  static CapabilityResource? tryParse(String value) {
    for (final resource in CapabilityResource.values) {
      if (resource.wireName == value) return resource;
    }

    return null;
  }
}

extension AppCapabilityActionX on CapabilityAction {
  String get wireName => switch (this) {
    .read => 'read',
    .create => 'create',
    .update => 'update',
    .delete => 'delete',
    .manage => 'manage',
    .review => 'review',
    .lifecycle => 'lifecycle',
  };

  static CapabilityAction? tryParse(String value) {
    for (final action in CapabilityAction.values) {
      if (action.wireName == value) return action;
    }
    return null;
  }
}
