import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Side-scroll roster page size — enough for a few swipes without chatty fetches.
const int facilityRosterPageSize = 12;

/// Full-list fetch size when hydrating "Ver todos" after opening with cache.
const int facilityRosterListPageSize = 100;

/// Phase 1 mock data for establishment detail sections.
EstablishmentDetailSections mockEstablishmentDetailSections(String facilityId) {
  final nearbySeed = mockNearbyClinicById(facilityId);
  final seed = facilityId.hashCode.abs();
  final baseLat = nearbySeed?.latitude ?? (-23.5505 + (seed % 100) * 0.0001);
  final baseLng = nearbySeed?.longitude ?? (-46.6333 + (seed % 100) * 0.0001);
  final now = DateTime.now();
  final formattedAddress = nearbySeed != null
      ? '${nearbySeed.streetAddress}, ${nearbySeed.streetNumber}'
            '${nearbySeed.addressComplement != null ? ' - ${nearbySeed.addressComplement}' : ''}'
            ' — ${nearbySeed.neighborhood}, São Paulo, SP'
      : 'Av. Paulista, 1000 — Bela Vista, São Paulo, SP';

  return EstablishmentDetailSections(
    location: EstablishmentLocation(
      latitude: baseLat,
      longitude: baseLng,
      formattedAddress: formattedAddress,
    ),
    services: const [
      FacilityServiceChip(serviceCode: '123', classificationCode: '01'),
      FacilityServiceChip(serviceCode: '145', classificationCode: '03'),
      FacilityServiceChip(serviceCode: '174', classificationCode: '02'),
    ],
    consultantName: 'Ana Silva',
    consultantSince: DateTime(2023, 3, 1),
    managerName: 'Roberto Mendes',
    managerSince: DateTime(2021, 8, 1),
    territoryLabel: 'Patch Centro SP',
    regionZoneLabel: 'Z. Sul',
    // Full catalogs for "Ver todos" / header specialties. Side-scroll strips
    // load via [mockFacilityAdministratorsPage] / [mockFacilityDoctorsPage].
    administrators: mockAllFacilityAdministrators(facilityId),
    doctors: mockAllFacilityDoctors(facilityId),
    payers: const [
      PayerShare(id: 'hp-1', name: 'Outras', sharePercent: 50),
      PayerShare(id: 'hp-2', name: 'Sul América', sharePercent: 20),
      PayerShare(id: 'hp-3', name: 'Amil', sharePercent: 10),
      PayerShare(id: 'hp-4', name: 'Bradesco Saúde', sharePercent: 10),
      PayerShare(id: 'hp-5', name: 'Porto Seguro Saúde', sharePercent: 10),
    ],
    payerMixSummary: PayerMixSummary(
      principalSourceName: 'Outras',
      principalSourcePercent: 50,
      registeredSourceCount: 5,
      updatedAt: now.subtract(const Duration(days: 14)),
    ),
    orders: [
      FacilityOrderSummary(
        id: 'ord-1',
        displayId: 'PED-1042',
        status: 'APPROVED',
        type: 'SALE',
        orderedAt: now.subtract(const Duration(days: 3)),
        total: 4850.00,
        itemCount: 4,
        items: const [
          FacilityOrderItemSummary(
            productName: 'Placa VLP 4.5mm 8 furos',
            quantity: 2,
            unitPrice: 890.00,
          ),
          FacilityOrderItemSummary(
            productName: 'Parafuso cortical 4.5mm',
            quantity: 12,
            unitPrice: 45.50,
          ),
          FacilityOrderItemSummary(
            productName: 'Kit instrumental descartável',
            quantity: 1,
            unitPrice: 1200.00,
          ),
          FacilityOrderItemSummary(
            productName: 'Fio de sutura 2-0',
            quantity: 4,
            unitPrice: 32.00,
          ),
        ],
      ),
      FacilityOrderSummary(
        id: 'ord-2',
        displayId: 'PED-1038',
        status: 'INVOICED',
        type: 'CONSIGNMENT',
        orderedAt: now.subtract(const Duration(days: 18)),
        total: 2120.50,
        itemCount: 2,
        items: const [
          FacilityOrderItemSummary(
            productName: 'Haste intramedular 9mm',
            quantity: 1,
            unitPrice: 1850.50,
          ),
          FacilityOrderItemSummary(
            productName: 'Parafuso bloqueado 5.0mm',
            quantity: 6,
            unitPrice: 45.00,
          ),
        ],
      ),
      FacilityOrderSummary(
        id: 'ord-3',
        displayId: 'PED-1021',
        status: 'PENDING',
        type: 'SALE',
        orderedAt: now.subtract(const Duration(days: 32)),
        total: 890.00,
        itemCount: 1,
        items: const [
          FacilityOrderItemSummary(
            productName: 'Cimento ósseo com antibiótico',
            quantity: 2,
            unitPrice: 445.00,
          ),
        ],
      ),
    ],
    nearbyEstablishments: _mockNearby(baseLat, baseLng, facilityId),
    statusSignals: FacilityStatusSignals(
      commercialStatus: FacilityCommercialStatus.active,
      purchaseStatus: FacilityPurchaseStatus.nonBuyer,
      conformityStatus: FacilityConformityStatus.complete,
      lastPurchaseAt: now.subtract(const Duration(days: 68)),
    ),
    taxIdType: FacilityTaxIdType.pj,
    phone: nearbySeed?.phone ?? '1130405060',
    whatsapp: nearbySeed?.whatsapp ?? '11987654321',
    email: nearbySeed?.email ?? 'contato@clinica.com.br',
    photos: PhotoGallerySummary(
      count: 5,
      thumbnailColors: const [
        Color(0xFF5eead4),
        AppColors.gray300,
        Color(0xFF1f2937),
        Color(0xFF93c5fd),
        Color(0xFFfbbf24),
      ],
      lastUpdatedAt: DateTime(2026, 2, 10),
    ),
    products: const [
      ProductUsage(
        name: 'AtlasGel',
        revenueLast6m: 28420,
        trendPercent: 12,
        sharePercent: 68,
      ),
      ProductUsage(
        name: 'CardioFlex',
        revenueLast6m: 43820,
        trendPercent: -22,
        sharePercent: 22,
      ),
      ProductUsage(
        name: 'AtlasVit',
        revenueLast6m: 15520,
        trendPercent: 58,
        sharePercent: 10,
      ),
    ],
    fieldNotes: [
      FacilityFieldNote(
        id: 'note-1',
        text: 'Estacionamento difícil — usar Zona Azul na rua de trás.',
        createdAt: now.subtract(const Duration(days: 40)),
      ),
      FacilityFieldNote(
        id: 'note-2',
        text: 'Recepcionista Ana é ótima ponte com Dra. Mariana.',
        createdAt: now.subtract(const Duration(days: 25)),
      ),
      FacilityFieldNote(
        id: 'note-3',
        text: 'Pedidos sempre fechados até dia 20 (fechamento contábil).',
        createdAt: now.subtract(const Duration(days: 10)),
      ),
    ],
    visitTimeline: [
      VisitTimelineEntry(
        id: 'visit-1',
        date: DateTime(now.year, 4, 17, 14, 30),
        title: 'Reunião agendada',
        sentiment: VisitSentiment.positive,
        attendees: 'com Dra. Mariana Silva',
        sampleGiven: 'AtlasGel 240g · 3un',
        summary:
            'Reunião com Dra. Mariana. Demonstração do novo AtlasGel 240g. '
            'Solicitou material impresso e amostras p/ 5 pacientes. '
            'Próximo pedido provável em 2 semanas.',
        durationMinutes: 42,
        consultantInitials: 'RM',
      ),
      VisitTimelineEntry(
        id: 'visit-2',
        date: DateTime(now.year, 4, 2, 10, 5),
        title: 'Passagem rápida, recepção',
        sentiment: VisitSentiment.mixed,
        attendees: 'Recepção',
        sampleGiven: 'CardioFlex · 3un',
        summary:
            'Passagem rápida, recepção. Deixei amostras CardioFlex. '
            'Helena (nova) chega em 15 dias.',
        durationMinutes: 12,
        consultantInitials: 'RM',
      ),
      VisitTimelineEntry(
        id: 'visit-3',
        date: DateTime(now.year, 3, 14, 16, 10),
        title: 'Fechamento de pedido',
        sentiment: VisitSentiment.mixed,
        attendees: 'com Dra. Mariana + Ana (compras)',
        linkedOrderValue: 4120,
        summary:
            'Fechamento de pedido. Pedido fechado R\$ 4.120. Cliente reclamou '
            'de atraso na entrega anterior. Verificar com logística.',
        durationMinutes: 55,
        consultantInitials: 'RM',
      ),
    ],
    visitStats: const VisitStats(
      visitCount: 8,
      totalOrdersValue: 7800,
      avgDurationMinutes: 39,
      periodLabel: 'últimos 4 meses',
    ),
    documents: _mockDocuments(now),
  );
}

/// Full administrative roster catalog for a facility (Phase 1 mock).
List<AdministrativeProfessional> mockAllFacilityAdministrators(
  String facilityId,
) {
  if (facilityId.endsWith(':empty')) return const [];

  const types = ['DECISOR', 'COMPRADOR', 'PROFESSIONAL'];
  const roles = [
    'Diretor administrativo',
    'Gerente de compras',
    'Coordenador financeiro',
    'Assistente administrativo',
    'Supervisor de contratos',
    'Analista de faturamento',
    'Secretária clínica',
    'Comprador hospitalar',
  ];
  const names = [
    'Carlos Mendes',
    'Fernanda Lima',
    'Ricardo Alves',
    'Juliana Costa',
    'Patrícia Nogueira',
    'Bruno Teixeira',
    'Camila Duarte',
    'Eduardo Ramos',
  ];

  return List<AdministrativeProfessional>.generate(names.length, (i) {
    final n = i + 1;
    final type = types[i % types.length];
    return AdministrativeProfessional(
      id: 'rep-$n',
      name: names[i],
      roleTitle: roles[i],
      email: '${names[i].split(' ').first.toLowerCase()}.$n@clinica.com.br',
      phone: '119${(87654321 - i * 1111).toString().padLeft(8, '0')}',
      contactType: type,
      isDecisionMaker: type == 'DECISOR',
      isBuyer: type == 'COMPRADOR',
      isSecretary: type == 'PROFESSIONAL' && i.isEven,
      isBiller: type == 'PROFESSIONAL' && i.isOdd,
      relationshipScore: i % 3 == 0 ? null : 3 + (i % 8),
    );
  });
}

/// Full doctor roster catalog for a facility (Phase 1 mock).
List<FacilityCrmDoctor> mockAllFacilityDoctors(String facilityId) {
  if (facilityId.endsWith(':empty')) return const [];

  const specialties = [
    'Ortopedia',
    'Ortopedia',
    'Clínica geral',
    'Cardiologia',
    'Neurologia',
    'Dermatologia',
    'Pediatria',
    'Anestesiologia',
    'Cirurgia geral',
  ];
  const names = [
    ('Dra. Mariana Silva', 'MS', 340.0),
    ('Dra. Helena Ferreira', 'HF', 210.0),
    ('Dr. Paulo Ferreira', 'PF', 160.0),
    ('Dr. André Souza', 'AS', 25.0),
    ('Dra. Beatriz Campos', 'BC', 280.0),
    ('Dr. Lucas Martins', 'LM', 190.0),
    ('Dra. Renata Oliveira', 'RO', 12.0),
    ('Dr. Felipe Araújo', 'FA', 95.0),
    ('Dra. Sofia Mendes', 'SM', 330.0),
  ];

  return List<FacilityCrmDoctor>.generate(names.length, (i) {
    final n = i + 1;
    final (name, initials, hue) = names[i];
    return FacilityCrmDoctor(
      id: 'doc-$n',
      name: name,
      initials: initials,
      hue: hue,
      specialty: specialties[i],
      crm: 'CRM/SP ${(140000 + i * 3711)}',
      phone: i % 4 == 3
          ? null
          : '119${(87654321 - i * 2222).toString().padLeft(8, '0')}',
      email: i % 5 == 4 ? null : '${initials.toLowerCase()}$n@exemplo.com',
      isPrescriber: i % 2 == 0,
      isBuyer: i == 2 || i == 7,
      isDecisionMaker: i == 0 || i == 4,
      roleBadge: i == 0
          ? 'DECISORA'
          : i == 1
          ? 'NOVA'
          : null,
      education: i < 3 ? 'USP (Medicina ${2008 + i * 4})' : null,
      birthdayLabel: i == 0 ? '14 de junho' : null,
      favoriteTeam: i == 0 ? 'Palmeiras' : null,
      interests: i == 0 ? 'Corrida de rua · vinhos' : null,
      relationshipScore: i % 3 == 2 ? null : 3 + (i % 8),
      noteText: i == 0 ? 'Prefere reuniões de manhã. Evita segundas.' : null,
    );
  });
}

/// One page of administrative professionals for the side-scroll strip.
Future<FacilityRosterPage<AdministrativeProfessional>>
mockFacilityAdministratorsPage({
  required String facilityId,
  required int page,
  int limit = facilityRosterPageSize,
}) async {
  return _sliceFacilityRosterPage(
    mockAllFacilityAdministrators(facilityId),
    page: page,
    limit: limit,
  );
}

/// One page of doctors for the side-scroll strip.
Future<FacilityRosterPage<FacilityCrmDoctor>> mockFacilityDoctorsPage({
  required String facilityId,
  required int page,
  int limit = facilityRosterPageSize,
}) async {
  return _sliceFacilityRosterPage(
    mockAllFacilityDoctors(facilityId),
    page: page,
    limit: limit,
  );
}

FacilityRosterPage<T> _sliceFacilityRosterPage<T>(
  List<T> all, {
  required int page,
  required int limit,
}) {
  final safeLimit = limit < 1 ? facilityRosterPageSize : limit;
  final total = all.length;
  final totalPages = total == 0 ? 0 : ((total + safeLimit - 1) ~/ safeLimit);
  final safePage = totalPages == 0 ? 1 : page.clamp(1, totalPages);
  final start = (safePage - 1) * safeLimit;
  final end = (start + safeLimit).clamp(0, total);

  return FacilityRosterPage<T>(
    items: all.sublist(start, end),
    pagination: Pagination(
      page: totalPages == 0 ? 1 : safePage,
      limit: safeLimit,
      total: total,
      totalPages: totalPages,
    ),
  );
}

/// Empty-roster fixture for Phase 1 empty/error UI checks.
/// Triggered when [facilityId] ends with `:empty`.
EstablishmentDetailSections mockEmptyEstablishmentDetailSections(
  String facilityId,
) {
  final seed = facilityId.hashCode.abs();
  return EstablishmentDetailSections(
    location: EstablishmentLocation(
      latitude: -23.5505 + (seed % 100) * 0.0001,
      longitude: -46.6333 + (seed % 100) * 0.0001,
      formattedAddress: 'Endereço não informado',
    ),
    consultantName: 'Ana Silva',
    consultantSince: DateTime(2023, 3, 1),
    managerName: 'Roberto Mendes',
    managerSince: DateTime(2021, 8, 1),
    territoryLabel: 'Patch Centro SP',
    regionZoneLabel: 'Z. Sul',
    administrators: const [],
    doctors: const [],
    payers: const [],
    payerMixSummary: null,
    orders: const [],
    nearbyEstablishments: const [],
    products: const [],
    fieldNotes: const [],
    visitTimeline: const [],
    documents: const [],
  );
}

/// Nearby-mock Cadastro checklist (PJ catalog + billing email).
List<EstablishmentDocument> _mockDocuments(DateTime now) => [
  EstablishmentDocument(
    id: 'carta_cnpj',
    title: 'Carta de CNPJ',
    description: 'Comprovante de inscrição e situação cadastral do CNPJ.',
    status: EstablishmentDocumentStatus.approved,
    submittedAt: now.subtract(const Duration(days: 210)),
    fileName: 'carta_cnpj.pdf',
  ),
  EstablishmentDocument(
    id: 'licenca_sanitaria',
    title: 'Licença Sanitária',
    description: 'Licença ou alvará sanitário vigente do estabelecimento.',
    status: EstablishmentDocumentStatus.pending,
    submittedAt: now.subtract(const Duration(days: 3)),
    fileName: 'licenca_sanitaria_2026.jpg',
  ),
  const EstablishmentDocument(
    id: 'billing_email',
    title: 'Email Administrativo',
    description: 'Email administrativo do estabelecimento.',
    kind: EstablishmentDocumentKind.billingEmail,
    billingEmail: 'financeiro@clinica.exemplo',
    status: EstablishmentDocumentStatus.approved,
  ),
];

/// Fixed absolute coords for Phase-1 "clínicas próximas" so tapping a pin
/// / callout can open `/workspace/clinic/<id>` with a real mock detail page
/// (same lat/lng as the pin — not regenerated from a hash).
class MockNearbyClinic {
  const MockNearbyClinic({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.specialtyLabel,
    required this.status,
    required this.neighborhood,
    required this.streetAddress,
    required this.streetNumber,
    this.addressComplement,
    this.phone = '1130405060',
    this.whatsapp = '11987654321',
    this.email,
    this.cnpj,
  });

  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final String specialtyLabel;
  final ClinicStatus status;
  final String neighborhood;
  final String streetAddress;
  final String streetNumber;
  final String? addressComplement;
  final String phone;
  final String whatsapp;
  final String? email;
  final String? cnpj;
}

/// Catalog centered around Av. Paulista — distances are computed at use time
/// against whichever facility is the search origin.
const List<MockNearbyClinic> mockNearbyClinicCatalog = [
  MockNearbyClinic(
    id: 'near-1',
    name: 'Centro Médico OrtoVita',
    latitude: -23.5618,
    longitude: -46.6559,
    specialtyLabel: 'Ortopedia',
    status: ClinicStatus.active,
    neighborhood: 'Jardim Paulista',
    streetAddress: 'Rua Augusta',
    streetNumber: '2200',
    addressComplement: 'Conjunto 12',
    email: 'contato@ortovita.example',
    cnpj: '12.345.678/0001-90',
  ),
  MockNearbyClinic(
    id: 'near-2',
    name: 'Instituto CardioMed',
    latitude: -23.5612,
    longitude: -46.6540,
    specialtyLabel: 'Cardio',
    status: ClinicStatus.negotiation,
    neighborhood: 'Bela Vista',
    streetAddress: 'Alameda Santos',
    streetNumber: '890',
    email: 'recepcao@cardiomed.example',
    cnpj: '23.456.789/0001-01',
  ),
  MockNearbyClinic(
    id: 'near-3',
    name: 'Clínica Vitalis Itaim',
    latitude: -23.5825,
    longitude: -46.6752,
    specialtyLabel: 'Multi',
    status: ClinicStatus.active,
    neighborhood: 'Itaim Bibi',
    streetAddress: 'Rua Joaquim Floriano',
    streetNumber: '454',
    addressComplement: 'Sala 302',
    email: 'contato@vitalis.example',
    cnpj: '34.567.890/0001-12',
  ),
  MockNearbyClinic(
    id: 'near-4',
    name: 'Policlínica Primavera',
    latitude: -23.5674,
    longitude: -46.6912,
    specialtyLabel: 'Derm · Ped',
    status: ClinicStatus.inactive,
    neighborhood: 'Pinheiros',
    streetAddress: 'Rua dos Pinheiros',
    streetNumber: '621',
    email: 'agenda@primavera.example',
    cnpj: '45.678.901/0001-23',
  ),
  MockNearbyClinic(
    id: 'near-5',
    name: 'Clínica São Lucas',
    latitude: -23.6012,
    longitude: -46.6638,
    specialtyLabel: 'Multi',
    status: ClinicStatus.active,
    neighborhood: 'Moema',
    streetAddress: 'Av. Ibirapuera',
    streetNumber: '2500',
    addressComplement: 'Bloco B',
    email: 'contato@saolucas.example',
    cnpj: '56.789.012/0001-34',
  ),
  MockNearbyClinic(
    id: 'near-6',
    name: 'Hospital Santa Clara',
    latitude: -23.5890,
    longitude: -46.6345,
    specialtyLabel: 'Multi',
    status: ClinicStatus.active,
    neighborhood: 'Vila Mariana',
    streetAddress: 'Rua Vergueiro',
    streetNumber: '1300',
    email: 'atendimento@santaclara.example',
    cnpj: '67.890.123/0001-45',
  ),
  MockNearbyClinic(
    id: 'near-7',
    name: 'Centro Médico Paulista',
    latitude: -23.5615,
    longitude: -46.6553,
    specialtyLabel: 'Clínica geral',
    status: ClinicStatus.negotiation,
    neighborhood: 'Consolação',
    streetAddress: 'Av. Paulista',
    streetNumber: '1578',
    addressComplement: 'Cj. 91',
    email: 'contato@cmpaulista.example',
    cnpj: '78.901.234/0001-56',
  ),
  MockNearbyClinic(
    id: 'near-8',
    name: 'Lab Diagnóstico Avançado',
    latitude: -23.5440,
    longitude: -46.6575,
    specialtyLabel: 'Diagnóstico',
    status: ClinicStatus.active,
    neighborhood: 'Higienópolis',
    streetAddress: 'Rua Maranhão',
    streetNumber: '210',
    email: 'lab@diagnostico.example',
    cnpj: '89.012.345/0001-67',
  ),
  MockNearbyClinic(
    id: 'near-9',
    name: 'Clínica Vida Plena',
    latitude: -23.5365,
    longitude: -46.6730,
    specialtyLabel: 'Multi',
    status: ClinicStatus.active,
    neighborhood: 'Perdizes',
    streetAddress: 'Rua Cardoso de Almeida',
    streetNumber: '900',
    email: 'contato@vidaplena.example',
    cnpj: '90.123.456/0001-78',
  ),
  MockNearbyClinic(
    id: 'near-10',
    name: 'Instituto Ortopédico SP',
    latitude: -23.5080,
    longitude: -46.6250,
    specialtyLabel: 'Ortopedia',
    status: ClinicStatus.active,
    neighborhood: 'Santana',
    streetAddress: 'Av. Cruzeiro do Sul',
    streetNumber: '1750',
    addressComplement: 'Torre 2',
    email: 'ortopedia@iosp.example',
    cnpj: '01.234.567/0001-89',
  ),
  MockNearbyClinic(
    id: 'near-11',
    name: 'Centro de Imagem Norte',
    latitude: -23.4805,
    longitude: -46.6030,
    specialtyLabel: 'Diagnóstico',
    status: ClinicStatus.active,
    neighborhood: 'Tucuruvi',
    streetAddress: 'Av. Tucuruvi',
    streetNumber: '640',
    email: 'imagem@norte.example',
    cnpj: '11.222.333/0001-44',
  ),
  MockNearbyClinic(
    id: 'near-12',
    name: 'Clínica Bem Estar',
    latitude: -23.6520,
    longitude: -46.7040,
    specialtyLabel: 'Multi',
    status: ClinicStatus.active,
    neighborhood: 'Santo Amaro',
    streetAddress: 'Av. Santo Amaro',
    streetNumber: '3200',
    email: 'contato@bemestar.example',
    cnpj: '22.333.444/0001-55',
  ),
];

MockNearbyClinic? mockNearbyClinicById(String id) {
  for (final clinic in mockNearbyClinicCatalog) {
    if (clinic.id == id) return clinic;
  }
  return null;
}

/// Header/identity mock for a nearby clinic opened from the map callout.
/// Returns `null` for non-mock facility ids (caller falls through to the API).
ClinicDetail? mockClinicDetailForNearbyId(String id) {
  final seed = mockNearbyClinicById(id);
  if (seed == null) return null;
  return ClinicDetail(
    id: seed.id,
    name: seed.name,
    city: 'São Paulo',
    state: 'SP',
    neighborhood: seed.neighborhood,
    distanceKm: 0,
    status: seed.status,
    lastVisitDays: null,
    doctorCount: 8,
    isPriority: false,
    products: const [],
    phone: seed.phone,
    whatsapp: seed.whatsapp,
    consultantName: 'Ana Silva',
    consultantSince: DateTime(2023, 3, 1),
    email: seed.email ?? 'contato@clinica.example',
    website: null,
    streetAddress: seed.streetAddress,
    streetNumber: seed.streetNumber,
    addressComplement: seed.addressComplement,
    postalCode: '01310-100',
    taxIdType: 'CNPJ',
    cnpj: seed.cnpj,
  );
}

List<NearbyEstablishment> _mockNearby(
  double centerLat,
  double centerLng,
  String excludeId,
) {
  final items = mockNearbyClinicCatalog
      .where((c) => c.id != excludeId)
      .map((c) {
        final distanceKm = _haversineKm(
          centerLat,
          centerLng,
          c.latitude,
          c.longitude,
        );
        return NearbyEstablishment(
          id: c.id,
          name: c.name,
          latitude: c.latitude,
          longitude: c.longitude,
          distanceKm: distanceKm,
          specialtyLabel: c.specialtyLabel,
          status: c.status,
          neighborhood: c.neighborhood,
          streetAddress: c.streetAddress,
          streetNumber: c.streetNumber,
          addressComplement: c.addressComplement,
        );
      })
      .where((e) => e.distanceKm <= establishmentNearbyDefaultRadiusKm)
      .toList();
  items.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
  return List<NearbyEstablishment>.unmodifiable(items);
}

double _haversineKm(double lat1, double lng1, double lat2, double lng2) {
  const earthRadiusKm = 6371.0088;
  final dLat = (lat2 - lat1) * math.pi / 180;
  final dLng = (lng2 - lng1) * math.pi / 180;
  final a =
      math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(lat1 * math.pi / 180) *
          math.cos(lat2 * math.pi / 180) *
          math.sin(dLng / 2) *
          math.sin(dLng / 2);
  return earthRadiusKm * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}
