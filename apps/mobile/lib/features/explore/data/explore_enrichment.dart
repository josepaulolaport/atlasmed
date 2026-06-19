import 'clinic_detail.dart';
import 'doctor_detail.dart';
import 'models.dart';
import 'mappers/explore_mapper.dart';

class ExploreSeed {
  ExploreSeed(String id) : _state = id.hashCode.abs();

  int _state;

  int _next() {
    _state = (_state * 1103515245 + 12345) & 0x7fffffff;
    return _state;
  }

  int pickInt(int min, int max) {
    if (max <= min) return min;
    return min + (_next() % (max - min + 1));
  }

  double pickDouble(double min, double max) {
    if (max <= min) return min;
    return min + (_next() % 1000) / 1000 * (max - min);
  }

  T pick<T>(List<T> items) => items[_next() % items.length];

  bool chance(int percent) => (_next() % 100) < percent;
}

const _products = ['AtlasGel', 'AtlasCaps', 'AtlasSpray', 'AtlasDerm'];
const _consultants = ['Rafael Melo', 'Ana Souza', 'Bruno Lima', 'Carla Mendes'];
const _payerNames = ['Unimed', 'Bradesco Saúde', 'SulAmérica', 'Amil', 'NotreDame', 'Outros'];
const _visitTypes = ['visita', 'retorno', 'entrega', 'reuniao'];
const _teams = ['Corinthians', 'Palmeiras', 'São Paulo', 'Santos', 'Flamengo'];
const _faculties = ['USP — Medicina', 'UNIFESP — Medicina', 'UNICAMP — Medicina', 'UFMG — Medicina'];

ClinicStatus _pickClinicStatus(ExploreSeed seed, bool isActive) {
  if (!isActive) return ClinicStatus.inativa;
  final roll = seed.pickInt(1, 100);
  if (roll <= 55) return ClinicStatus.ativa;
  if (roll <= 70) return ClinicStatus.negociacao;
  if (roll <= 82) return ClinicStatus.nunca;
  if (roll <= 92) return ClinicStatus.rejeicao;
  return ClinicStatus.inativa;
}

Clinic enrichClinic(Clinic clinic) {
  final seed = ExploreSeed(clinic.id);
  final products = clinic.products.isNotEmpty
      ? clinic.products
      : _products.where((_) => seed.chance(45)).take(seed.pickInt(1, 3)).toList();

  return Clinic(
    id: clinic.id,
    name: clinic.name,
    city: formatDisplayName(clinic.city),
    neighborhood: formatDisplayName(clinic.neighborhood),
    distanceKm: clinic.distanceKm > 0 ? clinic.distanceKm : seed.pickDouble(0.4, 12.0),
    status: clinic.status == ClinicStatus.ativa || clinic.status == ClinicStatus.inativa
        ? _pickClinicStatus(seed, clinic.isActive)
        : clinic.status,
    lastVisitDays: clinic.lastVisitDays ?? seed.pickInt(3, 120),
    doctorCount: clinic.doctorCount > 0 ? clinic.doctorCount : seed.pickInt(2, 24),
    isPriority: clinic.isPriority || seed.chance(18),
    products: products.isEmpty ? [seed.pick(_products)] : products,
    cnesCode: clinic.cnesCode,
    legalName: clinic.legalName != null ? formatDisplayName(clinic.legalName!) : null,
    fullAddress: clinic.fullAddress,
    postalCode: clinic.postalCode,
    stateCode: clinic.stateCode,
    stateName: clinic.stateName != null ? formatDisplayName(clinic.stateName!) : null,
    latitude: clinic.latitude,
    longitude: clinic.longitude,
    phone: clinic.phone,
    email: clinic.email,
    websiteUrl: clinic.websiteUrl,
    facilityType: clinic.facilityType != null ? formatDisplayName(clinic.facilityType!) : null,
    facilityTypeCode: clinic.facilityTypeCode,
    unitTypeName: clinic.unitTypeName != null ? formatDisplayName(clinic.unitTypeName!) : null,
    unitSubtypeName: clinic.unitSubtypeName != null ? formatDisplayName(clinic.unitSubtypeName!) : null,
    isActive: clinic.isActive,
  );
}

Doctor enrichDoctor(Doctor doctor) {
  final seed = ExploreSeed(doctor.id);
  return Doctor(
    id: doctor.id,
    name: doctor.name,
    initials: doctor.initials,
    hue: doctor.hue,
    specialty: doctor.specialty != '—'
        ? doctor.specialty
        : seed.pick(['Cardiologia', 'Ortopedia', 'Dermatologia', 'Pediatria', 'Neurologia']),
    primaryClinic: doctor.primaryClinic != '—' && doctor.primaryClinic.isNotEmpty
        ? doctor.primaryClinic
        : formatDisplayName('CLINICA ${seed.pick(['SAO LUCAS', 'SANTA MARIA', 'BEM ESTAR', 'VIDA'])}'),
    crm: doctor.crm.isNotEmpty
        ? doctor.crm
        : 'CRM-${doctor.id.substring(0, 2).toUpperCase()} ${seed.pickInt(100000, 999999)}',
    distanceKm: doctor.distanceKm > 0 ? doctor.distanceKm : seed.pickDouble(0.5, 15.0),
    isPriority: doctor.isPriority || seed.chance(15),
    socialName: doctor.socialName,
    activeFacilitiesCount:
        doctor.activeFacilitiesCount > 0 ? doctor.activeFacilitiesCount : seed.pickInt(1, 4),
    currentFacilities: doctor.currentFacilities,
    currentLocations: doctor.currentLocations,
    licenses: doctor.licenses,
    councils: doctor.councils,
    occupationCodes: doctor.occupationCodes,
    activePositions: doctor.activePositions > 0 ? doctor.activePositions : seed.pickInt(1, 3),
    totalWeeklyHours: doctor.totalWeeklyHours ?? seed.pickInt(20, 40),
    isPreceptor: doctor.isPreceptor || seed.chance(12),
    isResident: doctor.isResident || seed.chance(8),
  );
}

ClinicDetail enrichClinicDetail(ClinicDetail detail) {
  final seed = ExploreSeed(detail.id);
  final base = enrichClinic(
    Clinic(
      id: detail.id,
      name: detail.name,
      city: detail.city,
      neighborhood: detail.neighborhood,
      distanceKm: detail.distanceKm,
      status: detail.status,
      lastVisitDays: detail.lastVisitDays,
      doctorCount: detail.doctorCount,
      isPriority: detail.isPriority,
      products: detail.products,
      phone: detail.phone,
      email: detail.email,
      isActive: detail.status != ClinicStatus.inativa,
    ),
  );

  final doctors = detail.clinicDoctors
      .map(
        (d) => DoctorInfo(
          id: d.id,
          name: formatDisplayName(d.name),
          initials: d.initials,
          hue: d.hue,
          specialty: d.specialty != null ? formatOccupationLabel(d.specialty!) : null,
          crm: d.crm,
          isKeyOpinionLeader: d.isKeyOpinionLeader || ExploreSeed(d.id).chance(20),
          hasPendingInteraction: d.hasPendingInteraction || ExploreSeed(d.id).chance(15),
        ),
      )
      .toList();

  return ClinicDetail(
    id: detail.id,
    name: base.name,
    city: base.city,
    neighborhood: base.neighborhood,
    distanceKm: base.distanceKm,
    status: base.status,
    lastVisitDays: base.lastVisitDays,
    doctorCount: doctors.isNotEmpty ? doctors.length : base.doctorCount,
    isPriority: base.isPriority,
    products: base.products,
    phone: detail.phone ?? '(11) 9${seed.pickInt(1000, 9999)}-${seed.pickInt(1000, 9999)}',
    whatsapp: detail.whatsapp ?? '(11) 9${seed.pickInt(8000, 9999)}-${seed.pickInt(1000, 9999)}',
    consultantName: detail.consultantName ?? seed.pick(_consultants),
    clientType: detail.clientType ?? seed.pick(['Hospital', 'Clínica', 'UPA', 'Laboratório']),
    region: detail.region ?? base.stateName ?? 'Sudeste',
    streetAddress: detail.streetAddress,
    ltv: detail.ltv ?? seed.pickDouble(18000, 95000),
    avgTicket: detail.avgTicket ?? seed.pickDouble(800, 4200),
    avgPurchaseDays: detail.avgPurchaseDays ?? seed.pickInt(28, 75),
    payers: detail.payers.isNotEmpty
        ? detail.payers
        : [
            PayerInfo(name: seed.pick(_payerNames), percentage: 40),
            PayerInfo(name: seed.pick(_payerNames), percentage: 30),
            const PayerInfo(name: 'Outros', percentage: 30),
          ],
    visits: detail.visits.isNotEmpty
        ? detail.visits
        : List.generate(
            3,
            (i) => ClinicVisit(
              date: DateTime.now().subtract(Duration(days: seed.pickInt(10, 90) + i * 14)),
              type: seed.pick(_visitTypes),
              summary: seed.pick([
                'Apresentação de portfólio e revisão de estoque.',
                'Follow-up pós-congresso com boa receptividade.',
                'Entrega de amostras e alinhamento comercial.',
              ]),
              consultantName: seed.pick(_consultants),
              hasPendingOrder: seed.chance(25),
            ),
          ),
    clinicDoctors: doctors,
    fieldNotes: detail.fieldNotes ??
        'Preferência por visitas ${seed.pick(['matinais', 'no início da tarde', 'com agendamento prévio'])}.',
    cnpj: detail.cnpj ?? '${seed.pickInt(10, 99)}.${seed.pickInt(100, 999)}.${seed.pickInt(100, 999)}/0001-${seed.pickInt(10, 99)}',
    email: detail.email ?? 'contato@${detail.id.substring(0, 6)}.com.br',
    website: detail.website ?? 'www.${detail.id.substring(0, 8)}.com.br',
    responsibleDoctor:
        detail.responsibleDoctor ?? (doctors.isNotEmpty ? doctors.first.name : 'Dr. Responsável Técnico'),
    openingHours: detail.openingHours ?? 'Seg-Sex 07h-19h | Sáb 08h-13h',
    registeredSince: detail.registeredSince ?? DateTime(2015 + seed.pickInt(0, 8), seed.pickInt(1, 12)),
    segment: detail.segment ?? seed.pick(['Hospital Privado', 'Clínica Especializada', 'Rede Pública']),
    signals: detail.signals.isNotEmpty
        ? detail.signals
        : [
            ClinicSignal(
              type: seed.pick(['warning', 'info', 'success']),
              message: seed.pick([
                'Volume de prescrições cresceu no último trimestre.',
                'Nova contratação de especialista na unidade.',
                'Oportunidade de cross-sell com AtlasSpray.',
              ]),
            ),
          ],
    nearbyClinics: detail.nearbyClinics.isNotEmpty
        ? detail.nearbyClinics
        : List.generate(
            2,
            (i) => NearbyClinic(
              id: '${detail.id}-near-$i',
              name: formatDisplayName('UNIDADE ${seed.pick(['CENTRO', 'NORTE', 'SUL'])} ${i + 1}'),
              distanceKm: seed.pickDouble(0.6, 4.5),
            ),
          ),
    productPerformance: detail.productPerformance.isNotEmpty
        ? detail.productPerformance
        : base.products
            .map(
              (p) => ProductPerformance(
                name: p,
                trend: seed.pick(['up', 'down', 'stable']),
                percentageChange: seed.pickDouble(-8, 24),
                share: seed.pickDouble(20, 55),
              ),
            )
            .toList(),
  );
}

DoctorDetail enrichDoctorDetail(DoctorDetail detail) {
  final seed = ExploreSeed(detail.id);
  final base = enrichDoctor(
    Doctor(
      id: detail.id,
      name: detail.name,
      initials: detail.initials,
      hue: detail.hue,
      specialty: detail.specialty,
      primaryClinic: detail.clinics.isNotEmpty ? detail.clinics.first.name : '—',
      crm: detail.crm,
      distanceKm: detail.distanceKm,
      isPriority: false,
    ),
  );

  final clinics = detail.clinics
      .map(
        (c) => DoctorClinic(
          id: c.id,
          name: formatDisplayName(c.name),
          role: formatOccupationLabel(c.role),
          days: c.days,
          isMain: c.isMain,
        ),
      )
      .toList();

  return DoctorDetail(
    id: detail.id,
    name: base.name,
    initials: base.initials,
    hue: base.hue,
    specialty: base.specialty,
    crm: base.crm,
    role: detail.role.isNotEmpty ? formatOccupationLabel(detail.role) : '${base.specialty} · Prescritor',
    distanceKm: base.distanceKm,
    phone: detail.phone ?? '(11) 9${seed.pickInt(7000, 9999)}-${seed.pickInt(1000, 9999)}',
    email: detail.email ?? '${detail.id.substring(0, 6)}@health.mail',
    whatsapp: detail.whatsapp ?? detail.phone,
    birthday:
        detail.birthday ?? '${seed.pickInt(1, 28)} de ${seed.pick(['março', 'julho', 'setembro', 'novembro'])} · ${seed.pickInt(38, 58)} anos',
    faculty: detail.faculty ?? '${seed.pick(_faculties)} · ${2000 + seed.pickInt(0, 15)}',
    residency: detail.residency ?? 'Residência · ${base.specialty} (${2008 + seed.pickInt(0, 10)})',
    team: detail.team ?? seed.pick(_teams),
    interests: detail.interests ?? seed.pick(['Corrida · jazz', 'Vinho · gastronomia', 'Yoga · viagens']),
    language: detail.language ?? seed.pick(['Português · Inglês', 'Português · Espanhol', 'Português · Inglês · Francês']),
    statusLabel: detail.statusLabel.isNotEmpty ? detail.statusLabel : seed.pick(['Decisora', 'Prescritor', 'Influenciador']),
    statusColor: detail.statusColor,
    statusBg: detail.statusBg,
    relationshipLabel:
        detail.relationshipLabel.isNotEmpty ? detail.relationshipLabel : seed.pick(['Aberta', 'Neutra', 'Em construção']),
    relationshipColor: detail.relationshipColor,
    relationshipBg: detail.relationshipBg,
    gallery: detail.gallery.isNotEmpty
        ? detail.gallery
        : [
            DoctorPhoto(label: 'Perfil', date: '2026', hue: base.hue),
            DoctorPhoto(label: 'Cartão', date: '2025', hue: base.hue + 10),
          ],
    signals: detail.signals.isNotEmpty
        ? detail.signals
        : [
            DoctorSignal(
              kind: seed.pick(['good', 'info', 'warn']),
              title: seed.pick(['Crescimento em prescrições', 'Preferência de contato', 'Aniversário próximo']),
              body: seed.pick([
                'Volume subiu nos últimos 90 dias.',
                'Prefere contato por e-mail entre consultas.',
                'Enviar mensagem de relacionamento.',
              ]),
            ),
          ],
    prescribing: detail.prescribing.isNotEmpty
        ? detail.prescribing
        : [
            DoctorPrescribingItem(
              product: seed.pick(_products),
              volume: 'R\$ ${seed.pickInt(12, 85)}.${seed.pickInt(1, 9)}00',
              trend: List.generate(6, (i) => seed.pickInt(10, 20) + i * 2),
              growth: seed.pickInt(5, 35),
              share: seed.pickInt(40, 75),
            ),
          ],
    clinics: clinics,
    visits: detail.visits.isNotEmpty
        ? detail.visits
        : [
            DoctorVisit(
              date: '${seed.pickInt(1, 28)}/jun · seg',
              time: '${seed.pickInt(9, 16)}h${seed.pick(['00', '30'])}',
              duration: '${seed.pickInt(25, 55)} min',
              consultant: seed.pick(_consultants),
              consultantHue: 220,
              consultantInitials: 'RM',
              kind: seed.pick(['Visita agendada', 'Follow-up', 'Fechamento']),
              location: clinics.isNotEmpty ? clinics.first.name : 'Consultório',
              note: 'Conversa produtiva sobre portfólio e amostras.',
              outcome: seed.pick(['positivo', 'neutro', 'misto']),
            ),
          ],
    notes: detail.notes.isNotEmpty
        ? detail.notes
        : [
            'Prefere contato ${seed.pick(['por e-mail', 'via WhatsApp', 'com agendamento'])}.',
            'Bom canal para eventos científicos.',
          ],
  );
}
