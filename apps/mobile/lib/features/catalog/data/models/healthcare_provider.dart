import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

/// A fonte pagadora (`healthcare_providers`) — who pays for a procedure at a
/// clinic: a plan, the public system, the patient.
///
/// Referenced by `facility_healthcare_provider_shares`, so retirement is
/// `isActive = false` and there is no delete (spec 0016 §6.2).
enum HealthcareProviderType {
  private('PRIVATE', 'Privado'),
  public('PUBLIC', 'Público'),
  mixed('MIXED', 'Misto'),
  other('OTHER', 'Outro');

  const HealthcareProviderType(this.wire, this.label);

  /// The value the API stores; the enum on the column has exactly these four.
  final String wire;
  final String label;

  static HealthcareProviderType fromWire(String? value) =>
      HealthcareProviderType.values.firstWhere(
        (type) => type.wire == value,
        orElse: () => HealthcareProviderType.other,
      );
}

class HealthcareProvider {
  const HealthcareProvider({
    required this.id,
    required this.name,
    required this.type,
    this.isActive = true,
  });

  final int id;
  final String name;
  final HealthcareProviderType type;
  final bool isActive;

  factory HealthcareProvider.fromJson(Map<String, dynamic> json) {
    return HealthcareProvider(
      id: readCrmId(json['id'], 'id'),
      name: json['name'] as String,
      type: HealthcareProviderType.fromWire(json['type'] as String?),
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  HealthcareProvider copyWith({
    String? name,
    HealthcareProviderType? type,
    bool? isActive,
  }) => HealthcareProvider(
    id: id,
    name: name ?? this.name,
    type: type ?? this.type,
    isActive: isActive ?? this.isActive,
  );
}
