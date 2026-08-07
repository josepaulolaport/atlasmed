/// Facility-scoped person role codes (ADR 0004 §5.12).
///
/// Healthcare allow: PARTNER, PRESCRIBER, BUYER, DECISION_MAKER.
/// Admin allow: PARTNER, ADMINISTRATOR, DECISION_MAKER, BUYER, BILLER, SECRETARY.
abstract final class HealthcareRoleCodes {
  static const partner = 'PARTNER';
  static const prescriber = 'PRESCRIBER';
  static const buyer = 'BUYER';
  static const decisionMaker = 'DECISION_MAKER';

  static List<String> fromFlags({
    required bool isPartner,
    required bool isPrescriber,
    required bool isBuyer,
    required bool isDecisionMaker,
  }) => [
    if (isPartner) partner,
    if (isPrescriber) prescriber,
    if (isBuyer) buyer,
    if (isDecisionMaker) decisionMaker,
  ];

  static HealthcareRoleFlags toFlags(Iterable<String> codes) {
    final set = codes.map((c) => c.toUpperCase()).toSet();
    return HealthcareRoleFlags(
      isPartner: set.contains(partner),
      isPrescriber: set.contains(prescriber),
      isBuyer: set.contains(buyer),
      isDecisionMaker: set.contains(decisionMaker),
    );
  }
}

class HealthcareRoleFlags {
  const HealthcareRoleFlags({
    required this.isPartner,
    required this.isPrescriber,
    required this.isBuyer,
    required this.isDecisionMaker,
  });

  final bool isPartner;
  final bool isPrescriber;
  final bool isBuyer;
  final bool isDecisionMaker;
}

abstract final class AdministrativeRoleCodes {
  static const partner = 'PARTNER';
  static const administrator = 'ADMINISTRATOR';
  static const decisionMaker = 'DECISION_MAKER';
  static const buyer = 'BUYER';
  static const biller = 'BILLER';
  static const secretary = 'SECRETARY';

  static List<String> fromFlags({
    required bool isPartner,
    required bool isAdministrator,
    required bool isDecisionMaker,
    required bool isBuyer,
    required bool isBiller,
    required bool isSecretary,
  }) => [
    if (isPartner) partner,
    if (isAdministrator) administrator,
    if (isDecisionMaker) decisionMaker,
    if (isBuyer) buyer,
    if (isBiller) biller,
    if (isSecretary) secretary,
  ];

  static AdministrativeRoleFlags toFlags(Iterable<String> codes) {
    final set = codes.map((c) => c.toUpperCase()).toSet();
    return AdministrativeRoleFlags(
      isPartner: set.contains(partner),
      isAdministrator: set.contains(administrator),
      isDecisionMaker: set.contains(decisionMaker),
      isBuyer: set.contains(buyer),
      isBiller: set.contains(biller),
      isSecretary: set.contains(secretary),
    );
  }
}

class AdministrativeRoleFlags {
  const AdministrativeRoleFlags({
    required this.isPartner,
    required this.isAdministrator,
    required this.isDecisionMaker,
    required this.isBuyer,
    required this.isBiller,
    required this.isSecretary,
  });

  final bool isPartner;
  final bool isAdministrator;
  final bool isDecisionMaker;
  final bool isBuyer;
  final bool isBiller;
  final bool isSecretary;
}
