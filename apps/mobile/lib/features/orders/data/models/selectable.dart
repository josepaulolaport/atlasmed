/// Selectable clinic for checkout.
class SelectableClinic {
  final int id;
  final String name;
  const SelectableClinic({required this.id, required this.name});
}

/// Selectable doctor for checkout.
class SelectableDoctor {
  final int id;
  final String name;
  final String specialty;
  final int clinicId;
  const SelectableDoctor({
    required this.id,
    required this.name,
    required this.specialty,
    required this.clinicId,
  });
}
