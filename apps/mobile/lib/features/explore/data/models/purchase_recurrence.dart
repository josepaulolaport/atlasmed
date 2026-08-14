import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

enum PurchaseRecurrenceSource { defaultValue, calculated, manual }

enum PurchaseProfile {
  automatic,
  weekly,
  biweekly,
  monthly,
  bimonthly,
  quarterly,
  semiannual,
  annual,
  custom,
}

enum PurchaseFunnelStage {
  neverPurchased,
  outsideWindow,
  purchaseWindow,
  churn,
  inactive,
}

enum FacilitySort {
  relevance,
  distance,
  name,
  purchaseFunnelStage,
  purchaseIntervalDays,
  lastPurchaseDate,
}

enum SortOrder { asc, desc }

extension FacilitySortX on FacilitySort {
  String get apiValue => switch (this) {
    FacilitySort.relevance => 'relevance',
    FacilitySort.distance => 'distance',
    FacilitySort.name => 'name',
    FacilitySort.purchaseFunnelStage => 'purchaseFunnelStage',
    FacilitySort.purchaseIntervalDays => 'purchaseIntervalDays',
    FacilitySort.lastPurchaseDate => 'lastPurchaseDate',
  };
}

extension PurchaseRecurrenceSourceX on PurchaseRecurrenceSource {
  String get apiValue => switch (this) {
    PurchaseRecurrenceSource.defaultValue => 'DEFAULT',
    PurchaseRecurrenceSource.calculated => 'CALCULATED',
    PurchaseRecurrenceSource.manual => 'MANUAL',
  };

  String get label => switch (this) {
    PurchaseRecurrenceSource.defaultValue => 'Padrão',
    PurchaseRecurrenceSource.calculated => 'Calculado',
    PurchaseRecurrenceSource.manual => 'Manual',
  };
}

extension PurchaseProfileX on PurchaseProfile {
  String get apiValue => switch (this) {
    PurchaseProfile.automatic => 'AUTOMATIC',
    PurchaseProfile.weekly => 'WEEKLY',
    PurchaseProfile.biweekly => 'BIWEEKLY',
    PurchaseProfile.monthly => 'MONTHLY',
    PurchaseProfile.bimonthly => 'BIMONTHLY',
    PurchaseProfile.quarterly => 'QUARTERLY',
    PurchaseProfile.semiannual => 'SEMIANNUAL',
    PurchaseProfile.annual => 'ANNUAL',
    PurchaseProfile.custom => 'CUSTOM',
  };

  String get label => switch (this) {
    PurchaseProfile.automatic => 'Automático',
    PurchaseProfile.weekly => 'Semanal',
    PurchaseProfile.biweekly => 'Quinzenal',
    PurchaseProfile.monthly => 'Mensal',
    PurchaseProfile.bimonthly => 'Bimestral',
    PurchaseProfile.quarterly => 'Trimestral',
    PurchaseProfile.semiannual => 'Semestral',
    PurchaseProfile.annual => 'Anual',
    PurchaseProfile.custom => 'Personalizado',
  };

  int? get presetDays => switch (this) {
    PurchaseProfile.weekly => 7,
    PurchaseProfile.biweekly => 15,
    PurchaseProfile.monthly => 30,
    PurchaseProfile.bimonthly => 60,
    PurchaseProfile.quarterly => 90,
    PurchaseProfile.semiannual => 180,
    PurchaseProfile.annual => 365,
    PurchaseProfile.automatic || PurchaseProfile.custom => null,
  };

  String get optionLabel {
    final days = presetDays;
    return days == null ? label : '$label — $days dias';
  }
}

extension PurchaseFunnelStageX on PurchaseFunnelStage {
  String get apiValue => switch (this) {
    PurchaseFunnelStage.neverPurchased => 'NEVER_PURCHASED',
    PurchaseFunnelStage.outsideWindow => 'OUTSIDE_WINDOW',
    PurchaseFunnelStage.purchaseWindow => 'PURCHASE_WINDOW',
    PurchaseFunnelStage.churn => 'CHURN',
    PurchaseFunnelStage.inactive => 'INACTIVE',
  };

  /// Stage label, in the clinic's own terms.
  ///
  /// This used to route through `PurchaseBucketFilter.labelForFunnelApi`, so a
  /// clinic due to buy and one served last week both rendered as the bucket's
  /// label and looked identical — the distinction reps act on, discarded at the
  /// last step. The bucket label is still the right thing for the donut and the
  /// filter chips; a single clinic's badge should say what it actually is.
  String get label => switch (this) {
    PurchaseFunnelStage.neverPurchased => 'Nunca comprou',
    PurchaseFunnelStage.outsideWindow => 'Em dia',
    PurchaseFunnelStage.purchaseWindow => 'Janela de compra',
    PurchaseFunnelStage.churn => 'Em risco',
    PurchaseFunnelStage.inactive => 'Inativa',
  };

  /// The bucket's label, for surfaces that show the grouped view.
  String get bucketLabel =>
      PurchaseBucketFilter.labelForFunnelApi(apiValue) ?? apiValue;

  Color get color =>
      PurchaseBucketFilter.colorForFunnelApi(apiValue) ?? AppColors.gray500;

  Color get backgroundColor => color.withValues(alpha: 0.1);
}

PurchaseRecurrenceSource? purchaseRecurrenceSourceFromApi(Object? value) =>
    switch (value) {
      'DEFAULT' => PurchaseRecurrenceSource.defaultValue,
      'CALCULATED' => PurchaseRecurrenceSource.calculated,
      'MANUAL' => PurchaseRecurrenceSource.manual,
      _ => null,
    };

PurchaseProfile? purchaseProfileFromApi(Object? value) => switch (value) {
  'AUTOMATIC' => PurchaseProfile.automatic,
  'WEEKLY' => PurchaseProfile.weekly,
  'BIWEEKLY' => PurchaseProfile.biweekly,
  'MONTHLY' => PurchaseProfile.monthly,
  'BIMONTHLY' => PurchaseProfile.bimonthly,
  'QUARTERLY' => PurchaseProfile.quarterly,
  'SEMIANNUAL' => PurchaseProfile.semiannual,
  'ANNUAL' => PurchaseProfile.annual,
  'CUSTOM' => PurchaseProfile.custom,
  _ => null,
};

PurchaseFunnelStage? purchaseFunnelStageFromApi(Object? value) =>
    switch (value) {
      'NEVER_PURCHASED' => PurchaseFunnelStage.neverPurchased,
      'OUTSIDE_WINDOW' => PurchaseFunnelStage.outsideWindow,
      'PURCHASE_WINDOW' => PurchaseFunnelStage.purchaseWindow,
      'CHURN' => PurchaseFunnelStage.churn,
      'INACTIVE' => PurchaseFunnelStage.inactive,
      _ => null,
    };

DateTime? parseDateOnly(Object? value) {
  if (value is! String || !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) {
    return null;
  }
  final year = int.parse(value.substring(0, 4));
  final month = int.parse(value.substring(5, 7));
  final day = int.parse(value.substring(8, 10));
  final parsed = DateTime(year, month, day);
  return parsed.year == year && parsed.month == month && parsed.day == day
      ? parsed
      : null;
}

String formatDateOnly(DateTime? date) {
  if (date == null) return 'Não disponível';
  String two(int value) => value.toString().padLeft(2, '0');
  return '${two(date.day)}/${two(date.month)}/${date.year}';
}

class PurchaseRecurrenceSnapshot {
  const PurchaseRecurrenceSnapshot({
    required this.intervalDays,
    required this.sampleSize,
    this.observedIntervalDays,
    this.source,
    this.profile,
    this.lastPurchaseDate,
    this.funnelStage,
    this.nextTransitionDate,
    this.rawSource,
    this.rawProfile,
    this.rawFunnelStage,
  });

  factory PurchaseRecurrenceSnapshot.fromMap(Map<String, dynamic> map) {
    return PurchaseRecurrenceSnapshot(
      observedIntervalDays: map['observedIntervalDays'] as int?,
      intervalDays: (map['intervalDays'] as num?)?.toInt() ?? 0,
      source: purchaseRecurrenceSourceFromApi(map['source']),
      rawSource: map['source'] as String?,
      profile: purchaseProfileFromApi(map['profile']),
      rawProfile: map['profile'] as String?,
      lastPurchaseDate: parseDateOnly(map['lastPurchaseDate']),
      sampleSize: (map['sampleSize'] as num?)?.toInt() ?? 0,
      funnelStage: purchaseFunnelStageFromApi(map['funnelStage']),
      rawFunnelStage: map['funnelStage'] as String?,
      nextTransitionDate: parseDateOnly(map['nextTransitionDate']),
    );
  }

  final int? observedIntervalDays;
  final int intervalDays;
  final PurchaseRecurrenceSource? source;
  final PurchaseProfile? profile;
  final DateTime? lastPurchaseDate;
  final int sampleSize;
  final PurchaseFunnelStage? funnelStage;
  final DateTime? nextTransitionDate;
  final String? rawSource;
  final String? rawProfile;
  final String? rawFunnelStage;

  bool get hasUnknownEnums =>
      (rawSource != null && source == null) ||
      (rawProfile != null && profile == null) ||
      (rawFunnelStage != null && funnelStage == null);
}

sealed class PurchaseRecurrenceCommand {
  const PurchaseRecurrenceCommand({this.verticalId});

  /// Linha comercial — required by API when clinic has multiple profiles.
  final int? verticalId;

  void validate() {}

  Map<String, dynamic> toJson() {
    validate();
    return {
      'purchaseRecurrence': recurrenceBody(),
      if (verticalId != null && verticalId! > 0) 'verticalId': verticalId,
    };
  }

  Map<String, dynamic> recurrenceBody();
}

class AutomaticPurchaseRecurrence extends PurchaseRecurrenceCommand {
  const AutomaticPurchaseRecurrence({super.verticalId});

  @override
  Map<String, dynamic> recurrenceBody() => {'mode': 'AUTOMATIC'};
}

class PresetPurchaseRecurrence extends PurchaseRecurrenceCommand {
  const PresetPurchaseRecurrence(this.profile, {super.verticalId});

  final PurchaseProfile profile;

  @override
  void validate() {
    if (profile == PurchaseProfile.automatic ||
        profile == PurchaseProfile.custom) {
      throw ArgumentError.value(
        profile,
        'profile',
        'Perfil predefinido inválido',
      );
    }
  }

  @override
  Map<String, dynamic> recurrenceBody() => {
    'mode': 'PRESET',
    'profile': profile.apiValue,
  };
}

class CustomPurchaseRecurrence extends PurchaseRecurrenceCommand {
  const CustomPurchaseRecurrence(this.intervalDays, {super.verticalId});

  final int intervalDays;

  @override
  void validate() {
    if (intervalDays < 1 || intervalDays > 3650) {
      throw ArgumentError.value(
        intervalDays,
        'intervalDays',
        'O intervalo deve estar entre 1 e 3650 dias',
      );
    }
  }

  @override
  Map<String, dynamic> recurrenceBody() => {
    'mode': 'CUSTOM',
    'intervalDays': intervalDays,
  };
}
