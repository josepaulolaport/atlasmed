/// Selectable clinic for checkout.
class SelectableClinic {
  final String id;
  final String name;
  const SelectableClinic({required this.id, required this.name});
}

/// Selectable doctor for checkout.
class SelectableDoctor {
  final String id;
  final String name;
  final String specialty;
  final String clinicId;
  const SelectableDoctor({
    required this.id,
    required this.name,
    required this.specialty,
    required this.clinicId,
  });
}
