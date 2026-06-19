// ── Doctor detail model ───────────────────────────────────────

class DoctorDetail {
  final String id;
  final String name;
  final String initials;
  final double hue;
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
    required this.hue,
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
