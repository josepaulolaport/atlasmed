// ── Professional detail model ─────────────────────────────────

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';

class Professional {
  final String id;
  final String name;
  final String initials;
  final String specialty;
  final String crm;
  final String role;
  final double distanceKm;

  // Contact
  final String? phone;
  final String? email;
  final String? whatsapp;

  // Personal info
  final String? birthday;
  final String? faculty;
  final String? residency;
  final String? team;
  final String? interests;
  final String? language;

  // Status & relationship
  final String statusLabel;
  final int statusColor;
  final int statusBg;
  final String relationshipLabel;
  final int relationshipColor;
  final int relationshipBg;

  // Photos
  final List<GalleryItem> gallery;

  // Signals
  final List<ProfessionalSignal> signals;

  // Prescribing
  final List<PrescribingItem> prescribing;

  // Clinics
  final List<ProfessionalClinic> clinics;

  // Visit history
  final List<ProfessionalVisit> visits;

  // Field notes
  final List<String> notes;

  /// Maps a [ProfessionalDTO] from the detail endpoint into a [Professional].
  factory Professional.fromDTO(ProfessionalDTO dto) {
    final name = dto.displayName;
    final nameParts = name.split(' ');
    final initials = nameParts.length >= 2
        ? '${nameParts.first[0]}${nameParts.last[0]}'
        : name.isNotEmpty
        ? name[0]
        : '?';
    return Professional(
      id: dto.id,
      name: name,
      initials: initials.toUpperCase(),
      specialty: dto.specialty ?? '',
      crm: dto.crm,
      role: dto.specialty ?? '',
      distanceKm: dto.distanceKm ?? 0,
      phone: dto.phone,
      email: dto.email,
      whatsapp: null,
      birthday: dto.birthDate == null
          ? null
          : '${dto.birthDate!.year.toString().padLeft(4, '0')}-'
                '${dto.birthDate!.month.toString().padLeft(2, '0')}-'
                '${dto.birthDate!.day.toString().padLeft(2, '0')}',
      faculty: null,
      residency: null,
      team: dto.favoriteTeam,
      interests: dto.hobbies,
      language: dto.languages,
      statusLabel: '',
      relationshipLabel: '',
      notes: const [],
      clinics: dto.facilities
          .map(
            (f) =>
                ProfessionalClinic(id: f.id, name: f.name, role: '', days: ''),
          )
          .toList(growable: false),
      gallery: const [],
      signals: const [],
      prescribing: const [],
      visits: const [],
    );
  }

  /// Hue (0-360) derived from the professional's name for personalized colors.
  double get hue => (name.hashCode.abs() % 360).toDouble();

  const Professional({
    required this.id,
    required this.name,
    required this.initials,
    required this.specialty,
    required this.crm,
    required this.role,
    this.distanceKm = 0,
    this.phone,
    this.email,
    this.whatsapp,
    this.birthday,
    this.faculty,
    this.residency,
    this.team,
    this.interests,
    this.language,
    this.statusLabel = '',
    this.statusColor = 0xFF1e40af,
    this.statusBg = 0x1F1e40af,
    this.relationshipLabel = '',
    this.relationshipColor = 0xFF16a373,
    this.relationshipBg = 0x1F16a373,
    this.gallery = const [],
    this.signals = const [],
    this.prescribing = const [],
    this.clinics = const [],
    this.visits = const [],
    this.notes = const [],
  });

  Professional copyWith({
    String? id,
    String? name,
    String? initials,
    double? hue,
    String? specialty,
    String? crm,
    String? role,
    double? distanceKm,
    String? phone,
    bool clearPhone = false,
    String? email,
    bool clearEmail = false,
    String? whatsapp,
    bool clearWhatsapp = false,
    String? birthday,
    bool clearBirthday = false,
    String? faculty,
    bool clearFaculty = false,
    String? residency,
    bool clearResidency = false,
    String? team,
    bool clearTeam = false,
    String? interests,
    bool clearInterests = false,
    String? language,
    bool clearLanguage = false,
    String? statusLabel,
    int? statusColor,
    int? statusBg,
    String? relationshipLabel,
    int? relationshipColor,
    int? relationshipBg,
    List<GalleryItem>? gallery,
    List<ProfessionalSignal>? signals,
    List<PrescribingItem>? prescribing,
    List<ProfessionalClinic>? clinics,
    List<ProfessionalVisit>? visits,
    List<String>? notes,
  }) {
    return Professional(
      id: id ?? this.id,
      name: name ?? this.name,
      initials: initials ?? this.initials,
      specialty: specialty ?? this.specialty,
      crm: crm ?? this.crm,
      role: role ?? this.role,
      distanceKm: distanceKm ?? this.distanceKm,
      phone: clearPhone ? null : (phone ?? this.phone),
      email: clearEmail ? null : (email ?? this.email),
      whatsapp: clearWhatsapp ? null : (whatsapp ?? this.whatsapp),
      birthday: clearBirthday ? null : (birthday ?? this.birthday),
      faculty: clearFaculty ? null : (faculty ?? this.faculty),
      residency: clearResidency ? null : (residency ?? this.residency),
      team: clearTeam ? null : (team ?? this.team),
      interests: clearInterests ? null : (interests ?? this.interests),
      language: clearLanguage ? null : (language ?? this.language),
      statusLabel: statusLabel ?? this.statusLabel,
      statusColor: statusColor ?? this.statusColor,
      statusBg: statusBg ?? this.statusBg,
      relationshipLabel: relationshipLabel ?? this.relationshipLabel,
      relationshipColor: relationshipColor ?? this.relationshipColor,
      relationshipBg: relationshipBg ?? this.relationshipBg,
      gallery: gallery ?? this.gallery,
      signals: signals ?? this.signals,
      prescribing: prescribing ?? this.prescribing,
      clinics: clinics ?? this.clinics,
      visits: visits ?? this.visits,
      notes: notes ?? this.notes,
    );
  }
}

class GalleryItem {
  final String label;
  final String date;
  final double hue;

  const GalleryItem({
    required this.label,
    required this.date,
    required this.hue,
  });
}

class ProfessionalSignal {
  final String kind; // 'good', 'info', 'warn'
  final String title;
  final String body;

  const ProfessionalSignal({
    required this.kind,
    required this.title,
    required this.body,
  });
}

class PrescribingItem {
  final String product;
  final String volume;
  final List<int> trend;
  final int growth;
  final int share;
  final bool isNew;

  const PrescribingItem({
    required this.product,
    required this.volume,
    required this.trend,
    required this.growth,
    required this.share,
    this.isNew = false,
  });
}

class ProfessionalClinic {
  final String id;
  final String name;
  final String role;
  final String days;
  final bool isMain;
  final int statusColor;

  const ProfessionalClinic({
    required this.id,
    required this.name,
    required this.role,
    required this.days,
    this.isMain = false,
    this.statusColor = 0xFF16a373,
  });
}

class ProfessionalVisit {
  final String date;
  final String time;
  final String duration;
  final String consultant;
  final double consultantHue;
  final String consultantInitials;
  final String kind;
  final String location;
  final String note;
  final String outcome; // 'positivo', 'misto', 'neutro'
  final String? orderValue;
  final List<String>? samples;

  const ProfessionalVisit({
    required this.date,
    required this.time,
    required this.duration,
    required this.consultant,
    required this.consultantHue,
    required this.consultantInitials,
    required this.kind,
    required this.location,
    required this.note,
    required this.outcome,
    this.orderValue,
    this.samples,
  });
}

/// Color helpers derived from [Professional.hue].
extension ProfessionalColors on Professional {
  /// Primary color derived from the professional's name (for avatar backgrounds,
  /// headers, accents).
  Color get primaryColor => HSLColor.fromAHSL(1, hue, 0.55, 0.32).toColor();

  /// Lighter tint for backgrounds.
  Color get primaryBg => HSLColor.fromAHSL(1, hue, 0.48, 0.88).toColor();

  /// Semi-transparent version for subtle UI accents.
  Color get primaryAccent => primaryColor.withValues(alpha: 0.10);
}
