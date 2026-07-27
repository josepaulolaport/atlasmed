// ── Doctor detail model ───────────────────────────────────────

class DoctorDetail {
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
  final List<DoctorPhoto> gallery;

  // Signals
  final List<DoctorSignal> signals;

  // Prescribing
  final List<DoctorPrescribingItem> prescribing;

  // Clinics
  final List<DoctorClinic> clinics;

  // Visit history
  final List<DoctorVisit> visits;

  // Field notes
  final List<String> notes;

  const DoctorDetail({
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

  DoctorDetail copyWith({
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
    List<DoctorPhoto>? gallery,
    List<DoctorSignal>? signals,
    List<DoctorPrescribingItem>? prescribing,
    List<DoctorClinic>? clinics,
    List<DoctorVisit>? visits,
    List<String>? notes,
  }) {
    return DoctorDetail(
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

class DoctorPhoto {
  final String label;
  final String date;
  final double hue;

  const DoctorPhoto({
    required this.label,
    required this.date,
    required this.hue,
  });
}

class DoctorSignal {
  final String kind; // 'good', 'info', 'warn'
  final String title;
  final String body;

  const DoctorSignal({
    required this.kind,
    required this.title,
    required this.body,
  });
}

class DoctorPrescribingItem {
  final String product;
  final String volume;
  final List<int> trend;
  final int growth;
  final int share;
  final bool isNew;

  const DoctorPrescribingItem({
    required this.product,
    required this.volume,
    required this.trend,
    required this.growth,
    required this.share,
    this.isNew = false,
  });
}

class DoctorClinic {
  final String id;
  final String name;
  final String role;
  final String days;
  final bool isMain;
  final int statusColor;

  const DoctorClinic({
    required this.id,
    required this.name,
    required this.role,
    required this.days,
    this.isMain = false,
    this.statusColor = 0xFF16a373,
  });
}

class DoctorVisit {
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

  const DoctorVisit({
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
