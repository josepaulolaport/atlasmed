import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Which commercial job a stop does — spec 0016 §4.3.
enum RoteiroBucket { manter, recuperar, prospectar }

extension RoteiroBucketX on RoteiroBucket {
  String get label => switch (this) {
    RoteiroBucket.manter => 'Manter',
    RoteiroBucket.recuperar => 'Recuperar',
    RoteiroBucket.prospectar => 'Prospectar',
  };

  Color get color => switch (this) {
    RoteiroBucket.manter => AppColors.green,
    RoteiroBucket.recuperar => AppColors.amber,
    RoteiroBucket.prospectar => AppColors.blueAccent,
  };
}

RoteiroBucket bucketFromApi(Object? value) => switch (value) {
  'MANTER' => RoteiroBucket.manter,
  'RECUPERAR' => RoteiroBucket.recuperar,
  _ => RoteiroBucket.prospectar,
};

enum RoteiroModality { inPerson, remote }

extension RoteiroModalityX on RoteiroModality {
  String get label => this == RoteiroModality.remote ? 'Remoto' : 'Presencial';
  IconData get icon => this == RoteiroModality.remote
      ? Icons.phone_outlined
      : Icons.directions_car_outlined;
}

/// Everything the generation could not do — spec 0016 §4.8.
///
/// Rendered, never swallowed. A slate missing its prospecting stop looks
/// identical to one where prospecting was impossible, and only one of those is
/// worth acting on.
class RoteiroNotice {
  const RoteiroNotice({required this.code, required this.message});

  factory RoteiroNotice.fromJson(Map<String, dynamic> json) => RoteiroNotice(
    code: json['code'] as String? ?? 'UNKNOWN',
    message: json['message'] as String? ?? '',
  );

  final String code;
  final String message;

  /// `NO_CANDIDATES` is a dead end; the rest are context, not failure.
  bool get isBlocking => code == 'NO_CANDIDATES';
}

class RoteiroStop {
  const RoteiroStop({
    required this.position,
    required this.facilityId,
    required this.facilityVerticalProfileId,
    required this.facilityName,
    required this.bucket,
    required this.modality,
    required this.serviceMinutes,
    required this.plannedStartsAt,
    required this.plannedEndsAt,
    required this.isCoverageSlot,
    required this.isAnchor,
    required this.reasons,
    this.municipality,
    this.neighborhood,
    this.unitType,
    this.travelSecondsFromPrev,
    this.straightLineKm,
    this.lat,
    this.lng,
  });

  factory RoteiroStop.fromJson(Map<String, dynamic> json) {
    final candidate = json['candidate'] as Map<String, dynamic>? ?? const {};
    final components =
        (candidate['components'] as Map?)?.cast<String, dynamic>() ?? const {};
    return RoteiroStop(
      position: (json['position'] as num?)?.toInt() ?? 0,
      facilityId: (candidate['facilityId'] as num?)?.toInt() ?? 0,
      facilityVerticalProfileId:
          (candidate['facilityVerticalProfileId'] as num?)?.toInt() ?? 0,
      facilityName: candidate['facilityName'] as String? ?? 'Clínica',
      municipality: candidate['municipality'] as String?,
      neighborhood: candidate['neighborhood'] as String?,
      unitType: candidate['unitType'] as String?,
      bucket: bucketFromApi(candidate['bucket']),
      modality: json['modality'] == 'REMOTE'
          ? RoteiroModality.remote
          : RoteiroModality.inPerson,
      serviceMinutes: (json['serviceMinutes'] as num?)?.toInt() ?? 0,
      travelSecondsFromPrev: (json['travelSecondsFromPrev'] as num?)?.toInt(),
      straightLineKm: (candidate['straightLineKm'] as num?)?.toDouble(),
      lat: (candidate['lat'] as num?)?.toDouble(),
      lng: (candidate['lng'] as num?)?.toDouble(),
      plannedStartsAt:
          DateTime.tryParse(
            json['plannedStartsAt'] as String? ?? '',
          )?.toLocal() ??
          DateTime.now(),
      plannedEndsAt:
          DateTime.tryParse(
            json['plannedEndsAt'] as String? ?? '',
          )?.toLocal() ??
          DateTime.now(),
      isCoverageSlot: json['isCoverageSlot'] as bool? ?? false,
      isAnchor: json['isAnchor'] as bool? ?? false,
      reasons: buildReasons(
        components,
        coverage: json['isCoverageSlot'] as bool? ?? false,
      ),
    );
  }

  final int position;
  final int facilityId;
  final int facilityVerticalProfileId;
  final String facilityName;
  final String? municipality;

  /// Bairro, from CNES.
  ///
  /// Load-bearing, not decoration: 61 name-groups in the book cover 149
  /// facilities — eight Vita Clínicas branches share one name across São Paulo.
  /// Two of them can legitimately appear in the same day, and without the bairro
  /// they render as the same clinic listed twice.
  final String? neighborhood;
  final String? unitType;
  final RoteiroBucket bucket;
  final RoteiroModality modality;
  final int serviceMinutes;
  final int? travelSecondsFromPrev;
  final double? straightLineKm;

  /// Where the clinic is. Needed to draw the day on a map (§15.4.3); the API
  /// has always sent these and the client used to drop them.
  final double? lat;
  final double? lng;
  final DateTime plannedStartsAt;
  final DateTime plannedEndsAt;
  final bool isCoverageSlot;
  final bool isAnchor;

  /// Why this clinic is here, in the rep's words. Never empty.
  final List<String> reasons;
}

/// Turns the score breakdown into sentences — spec 0016 §5.2.
///
/// **Every reason must trace to a component the server sent.** Nothing here is
/// invented and nothing is produced by a language model (§12): if we cannot say
/// why a clinic is on the list, it does not belong on the list. The templates
/// live client-side so the wording can change without a deploy of the engine,
/// but the *facts* are entirely the server's.
List<String> buildReasons(
  Map<String, dynamic> components, {
  required bool coverage,
}) {
  final reasons = <String>[];

  Map<String, dynamic>? part(String key) =>
      (components[key] as Map?)?.cast<String, dynamic>();

  final capacity = part('c');
  final orthopaedists = (capacity?['orthopaedists'] as num?)?.toInt() ?? 0;
  final share = (capacity?['orthopaedistShare'] as num?)?.toDouble();
  if (orthopaedists > 0) {
    final head = orthopaedists == 1
        ? '1 ortopedista registrado aqui'
        : '$orthopaedists ortopedistas registrados aqui';
    // The share is what separates a clinic from a hospital that happens to
    // employ a few orthopaedists — measured, ≥40% converts at 32% against 11%.
    // Only worth saying when it is high enough to mean something.
    reasons.add(
      share != null && share >= 0.5
          ? '$head — ${(share * 100).round()}% do corpo clínico'
          : head,
    );
  }

  final timing = part('t');
  final stage = timing?['stage'] as String?;
  final daysSincePurchase = (timing?['daysSinceLastPurchase'] as num?)?.toInt();
  final intervalDays = (timing?['intervalDays'] as num?)?.toInt();
  if (stage == 'NEVER_PURCHASED') {
    reasons.add('Nunca comprou');
  } else if (stage == 'PURCHASE_WINDOW' &&
      daysSincePurchase != null &&
      intervalDays != null) {
    final due = intervalDays - daysSincePurchase;
    reasons.add(
      due > 0
          ? 'Entra na janela de compra em $due dias'
          : 'Na janela de compra há ${-due} dias',
    );
  } else if (stage == 'CHURN') {
    reasons.add('Em risco — passou do intervalo de compra');
  } else if (stage == 'INACTIVE') {
    reasons.add('Inativa — sem compras há muito tempo');
  }

  final headroom = part('h');
  final surveyed = headroom?['surveyed'] as bool? ?? false;
  final theirs = (headroom?['theirsQty'] as num?)?.toDouble();
  if (surveyed && theirs != null && theirs > 0) {
    reasons.add('Concorrente com ${theirs.toStringAsFixed(0)}/mês aqui');
  } else if (!surveyed) {
    reasons.add('Potencial não medido — vale levantar a concorrência');
  }

  final neglect = part('n');
  final daysSinceVisit = (neglect?['daysSinceLastInteraction'] as num?)
      ?.toInt();
  if (coverage && daysSinceVisit == null) {
    reasons.add('Ainda não visitada');
  } else if (daysSinceVisit != null && daysSinceVisit >= 30) {
    reasons.add('Sem visita há $daysSinceVisit dias');
  }

  // Appended in c, t, h, n order — capacity and timing first, because those are
  // the two components that actually rank this book (§4.2). A card showing only
  // the first three therefore still leads with the reason that put the clinic
  // here.

  if (reasons.isEmpty) {
    reasons.add('Selecionada pelo conjunto de critérios do roteiro');
  }
  return reasons;
}

/// A visit the rep already had booked, read from their calendar.
///
/// Shown alongside the suggestions because a slate without them is unreadable:
/// two suggestions floating in an empty day look arbitrary until you can see
/// the five commitments they were planned around.
class RoteiroFixedPoint {
  const RoteiroFixedPoint({
    required this.facilityId,
    required this.facilityName,
    required this.startsAt,
    required this.endsAt,
    this.lat,
    this.lng,
  });

  factory RoteiroFixedPoint.fromJson(Map<String, dynamic> json) =>
      RoteiroFixedPoint(
        facilityId: (json['facilityId'] as num?)?.toInt() ?? 0,
        facilityName: json['facilityName'] as String? ?? 'Compromisso',
        lat: (json['lat'] as num?)?.toDouble(),
        lng: (json['lng'] as num?)?.toDouble(),
        startsAt:
            DateTime.tryParse(json['startsAt'] as String? ?? '')?.toLocal() ??
            DateTime.now(),
        endsAt:
            DateTime.tryParse(json['endsAt'] as String? ?? '')?.toLocal() ??
            DateTime.now(),
      );

  final int facilityId;
  final String facilityName;
  final double? lat;
  final double? lng;
  final DateTime startsAt;
  final DateTime endsAt;
}

/// A clinic the rep may add to the day by hand.
class AddableClinic {
  const AddableClinic({
    required this.facilityVerticalProfileId,
    required this.facilityName,
    required this.funnelStage,
    this.municipality,
    this.neighborhood,
  });

  factory AddableClinic.fromJson(Map<String, dynamic> json) => AddableClinic(
    facilityVerticalProfileId:
        (json['facilityVerticalProfileId'] as num?)?.toInt() ?? 0,
    facilityName: json['facilityName'] as String? ?? 'Clínica',
    funnelStage: json['funnelStage'] as String? ?? '',
    municipality: json['municipality'] as String?,
    neighborhood: json['neighborhood'] as String?,
  );

  final int facilityVerticalProfileId;
  final String facilityName;
  final String funnelStage;
  final String? municipality;
  final String? neighborhood;

  /// The bairro tells two branches of a chain apart; the city is the fallback.
  String? get place => neighborhood ?? municipality;
}

class Roteiro {
  const Roteiro({
    this.id,
    this.status,
    required this.scopeDate,
    required this.reachMode,
    required this.reachBoundKm,
    required this.travelSource,
    required this.stops,
    required this.fixedPoints,
    required this.notices,
    required this.driveSeconds,
    required this.serviceMinutes,
    this.endsAt,
  });

  factory Roteiro.fromJson(Map<String, dynamic> json) {
    final totals =
        (json['totals'] as Map?)?.cast<String, dynamic>() ?? const {};
    return Roteiro(
      id: (json['id'] as num?)?.toInt(),
      status: json['status'] as String?,
      scopeDate: json['scopeDate'] as String? ?? '',
      reachMode: json['reachMode'] as String? ?? 'LIVRE',
      reachBoundKm: (json['reachBoundKm'] as num?)?.toInt() ?? 0,
      travelSource: json['travelSource'] as String? ?? 'ESTIMATED',
      stops: ((json['stops'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => RoteiroStop.fromJson(e.cast<String, dynamic>()))
          .toList(),
      fixedPoints: ((json['fixedPoints'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => RoteiroFixedPoint.fromJson(e.cast<String, dynamic>()))
          .toList(),
      notices: ((json['notices'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => RoteiroNotice.fromJson(e.cast<String, dynamic>()))
          .toList(),
      driveSeconds: (totals['driveSeconds'] as num?)?.toInt() ?? 0,
      serviceMinutes: (totals['serviceMinutes'] as num?)?.toInt() ?? 0,
      endsAt: DateTime.tryParse(totals['endsAt'] as String? ?? '')?.toLocal(),
    );
  }

  /// Null for a preview, which is deliberately not persisted.
  final int? id;
  final String? status;
  final String scopeDate;
  final String reachMode;
  final int reachBoundKm;

  /// `ESTIMATED` while P1 has no Mapbox Matrix. The UI must say so rather than
  /// present a straight-line guess as a measured drive.
  final String travelSource;
  final List<RoteiroStop> stops;

  /// Visits the rep already had. Not suggestions — context.
  final List<RoteiroFixedPoint> fixedPoints;
  final List<RoteiroNotice> notices;
  final int driveSeconds;
  final int serviceMinutes;
  final DateTime? endsAt;

  bool get isEstimated => travelSource == 'ESTIMATED';
  bool get isAnchored => reachMode == 'ANCORA';
  bool get isConfirmed => status == 'CONFIRMED';
  bool get canConfirm => id != null && status == 'DRAFT' && stops.isNotEmpty;
}
