import 'clinic_detail.dart';
import 'doctor_detail.dart';
import 'explore_list_filters.dart';
import 'explore_page.dart';
import 'explore_repository.dart';
import 'models.dart';

class MockExploreRepository implements ExploreRepository {
  @override
  Future<ExplorePage<Clinic>> getClinics({
    String? search,
    ExploreListFilters filters = const ExploreListFilters(),
    int page = 1,
    int limit = explorePageSize,
  }) async {
    await Future.delayed(const Duration(milliseconds: 800));
    var list = _clinics;
    if (search != null && search.trim().length >= 2) {
      final q = search.trim().toLowerCase();
      list = list
          .where(
            (c) =>
                c.name.toLowerCase().contains(q) ||
                c.city.toLowerCase().contains(q) ||
                c.neighborhood.toLowerCase().contains(q),
          )
          .toList();
    }
    final start = (page - 1) * limit;
    final slice = list.skip(start).take(limit).toList();
    return ExplorePage(
      items: slice,
      hasMore: start + slice.length < list.length,
      page: page,
    );
  }

  @override
  Future<ExplorePage<Doctor>> getDoctors({
    String? search,
    int page = 1,
    int limit = explorePageSize,
  }) async {
    await Future.delayed(const Duration(milliseconds: 800));
    var list = _doctors;
    if (search != null && search.trim().length >= 2) {
      final q = search.trim().toLowerCase();
      list = list
          .where(
            (d) =>
                d.name.toLowerCase().contains(q) ||
                d.specialty.toLowerCase().contains(q),
          )
          .toList();
    }
    final start = (page - 1) * limit;
    final slice = list.skip(start).take(limit).toList();
    return ExplorePage(
      items: slice,
      hasMore: start + slice.length < list.length,
      page: page,
    );
  }

  @override
  Future<ClinicDetail> getClinicDetail(String id) async {
    await Future.delayed(const Duration(milliseconds: 600));
    // Find matching mock detail
    final detail = _clinicDetails.firstWhere(
      (d) => d.id == id,
      orElse: () => _clinicDetails.first,
    );
    return detail;
  }

  @override
  Future<DoctorDetail> getDoctorDetail(String id) async {
    await Future.delayed(const Duration(milliseconds: 600));
    final detail = _doctorDetails.firstWhere(
      (d) => d.id == id,
      orElse: () => _doctorDetails.first,
    );
    return detail;
  }

  @override
  Future<ExploreFilterOptions> getFacilityFilterOptions() async {
    return const ExploreFilterOptions(
      states: [
        ExploreStateOption(code: 'SP', name: 'São Paulo'),
        ExploreStateOption(code: 'RJ', name: 'Rio de Janeiro'),
        ExploreStateOption(code: 'MG', name: 'Minas Gerais'),
      ],
      facilityTypes: ['Hospital Geral', 'Clínica', 'UPA', 'Laboratório'],
    );
  }

  @override
  Future<List<ExploreCityOption>> searchCities({
    String? search,
    List<String> stateCodes = const [],
    int limit = 40,
  }) async {
    const cities = [
      ExploreCityOption(name: 'São Paulo', stateCode: 'SP'),
      ExploreCityOption(name: 'Rio de Janeiro', stateCode: 'RJ'),
      ExploreCityOption(name: 'Belo Horizonte', stateCode: 'MG'),
      ExploreCityOption(name: 'Curitiba', stateCode: 'PR'),
    ];

    var results = cities;
    if (stateCodes.isNotEmpty) {
      results = results.where((c) => stateCodes.contains(c.stateCode)).toList();
    }
    if (search != null && search.trim().isNotEmpty) {
      final q = search.trim().toLowerCase();
      results = results.where((c) => c.name.toLowerCase().contains(q)).toList();
    }
    return results.take(limit).toList();
  }
}

// ── Mock clinics ─────────────────────────────────────────────
const _clinics = [
  Clinic(
    id: 'c1',
    name: 'Hospital São Lucas',
    city: 'São Paulo, SP',
    neighborhood: 'Vila Mariana',
    distanceKm: 1.2,
    status: ClinicStatus.ativa,
    lastVisitDays: 5,
    doctorCount: 12,
    isPriority: true,
    products: ['AtlasGel', 'AtlasCaps', 'AtlasSpray'],
  ),
  Clinic(
    id: 'c2',
    name: 'Clínica Santa Maria',
    city: 'São Paulo, SP',
    neighborhood: 'Moema',
    distanceKm: 2.8,
    status: ClinicStatus.ativa,
    lastVisitDays: 18,
    doctorCount: 8,
    isPriority: false,
    products: ['AtlasGel', 'AtlasCaps'],
  ),
  Clinic(
    id: 'c3',
    name: 'Centro Médico Albert Einstein',
    city: 'São Paulo, SP',
    neighborhood: 'Morumbi',
    distanceKm: 4.5,
    status: ClinicStatus.negociacao,
    lastVisitDays: 45,
    doctorCount: 25,
    isPriority: true,
    products: ['AtlasSpray'],
  ),
  Clinic(
    id: 'c4',
    name: 'Policlínica Nossa Senhora Aparecida',
    city: 'São Paulo, SP',
    neighborhood: 'Santana',
    distanceKm: 6.1,
    status: ClinicStatus.ativa,
    lastVisitDays: 3,
    doctorCount: 15,
    isPriority: false,
    products: ['AtlasGel', 'AtlasCaps', 'AtlasSpray', 'AtlasDerm'],
  ),
  Clinic(
    id: 'c5',
    name: 'Clínica Saúde Total',
    city: 'Osasco, SP',
    neighborhood: 'Centro',
    distanceKm: 12.3,
    status: ClinicStatus.inativa,
    lastVisitDays: 180,
    doctorCount: 6,
    isPriority: false,
    products: [],
  ),
  Clinic(
    id: 'c6',
    name: 'Hospital Samaritano',
    city: 'São Paulo, SP',
    neighborhood: 'Higienópolis',
    distanceKm: 3.2,
    status: ClinicStatus.ativa,
    lastVisitDays: 12,
    doctorCount: 20,
    isPriority: true,
    products: ['AtlasGel', 'AtlasSpray'],
  ),
  Clinic(
    id: 'c7',
    name: 'Clínica Bem Estar',
    city: 'São Paulo, SP',
    neighborhood: 'Pinheiros',
    distanceKm: 0.8,
    status: ClinicStatus.nunca,
    lastVisitDays: null,
    doctorCount: 4,
    isPriority: false,
    products: [],
  ),
  Clinic(
    id: 'c8',
    name: 'Hospital e Maternidade São Luiz',
    city: 'São Paulo, SP',
    neighborhood: 'Itaim Bibi',
    distanceKm: 2.1,
    status: ClinicStatus.rejeicao,
    lastVisitDays: 365,
    doctorCount: 18,
    isPriority: false,
    products: [],
  ),
  Clinic(
    id: 'c9',
    name: 'Clínica do Coração',
    city: 'São Bernardo, SP',
    neighborhood: 'Rudge Ramos',
    distanceKm: 14.7,
    status: ClinicStatus.negociacao,
    lastVisitDays: 30,
    doctorCount: 7,
    isPriority: true,
    products: ['AtlasCaps'],
  ),
  Clinic(
    id: 'c10',
    name: 'Centro Médico São Camilo',
    city: 'São Paulo, SP',
    neighborhood: 'Pompéia',
    distanceKm: 5.0,
    status: ClinicStatus.ativa,
    lastVisitDays: 22,
    doctorCount: 14,
    isPriority: false,
    products: ['AtlasGel', 'AtlasDerm'],
  ),
  Clinic(
    id: 'c11',
    name: 'Clínica Vita',
    city: 'Guarulhos, SP',
    neighborhood: 'Centro',
    distanceKm: 15.3,
    status: ClinicStatus.ativa,
    lastVisitDays: 60,
    doctorCount: 5,
    isPriority: false,
    products: ['AtlasSpray'],
  ),
  Clinic(
    id: 'c12',
    name: 'Hospital São Paulo',
    city: 'São Paulo, SP',
    neighborhood: 'Vila Clementino',
    distanceKm: 1.2,
    status: ClinicStatus.ativa,
    lastVisitDays: 7,
    doctorCount: 22,
    isPriority: true,
    products: ['AtlasGel', 'AtlasCaps', 'AtlasSpray'],
  ),
];

// ── Mock doctors ─────────────────────────────────────────────
const _doctors = [
  Doctor(
    id: 'd1',
    name: 'Dra. Ana Beatriz Oliveira',
    initials: 'AB',
    hue: 210,
    specialty: 'Cardiologia',
    primaryClinic: 'Hospital São Lucas',
    crm: 'CRM-SP 123456',
    distanceKm: 1.2,
    isPriority: true,
  ),
  Doctor(
    id: 'd2',
    name: 'Dr. Carlos Eduardo Santos',
    initials: 'CE',
    hue: 340,
    specialty: 'Ortopedia',
    primaryClinic: 'Hospital São Lucas',
    crm: 'CRM-SP 234567',
    distanceKm: 1.2,
    isPriority: false,
  ),
  Doctor(
    id: 'd3',
    name: 'Dra. Marina Costa',
    initials: 'MC',
    hue: 160,
    specialty: 'Dermatologia',
    primaryClinic: 'Clínica Santa Maria',
    crm: 'CRM-SP 345678',
    distanceKm: 2.8,
    isPriority: false,
  ),
  Doctor(
    id: 'd4',
    name: 'Dr. Roberto Almeida',
    initials: 'RA',
    hue: 30,
    specialty: 'Pediatria',
    primaryClinic: 'Centro Médico Albert Einstein',
    crm: 'CRM-SP 456789',
    distanceKm: 4.5,
    isPriority: true,
  ),
  Doctor(
    id: 'd5',
    name: 'Dra. Juliana Lima',
    initials: 'JL',
    hue: 280,
    specialty: 'Ginecologia',
    primaryClinic: 'Policlínica Nossa Senhora Aparecida',
    crm: 'CRM-SP 567890',
    distanceKm: 6.1,
    isPriority: false,
  ),
  Doctor(
    id: 'd6',
    name: 'Dr. Fernando Pereira',
    initials: 'FP',
    hue: 100,
    specialty: 'Neurologia',
    primaryClinic: 'Hospital Samaritano',
    crm: 'CRM-SP 678901',
    distanceKm: 3.2,
    isPriority: true,
  ),
  Doctor(
    id: 'd7',
    name: 'Dra. Patrícia Martins',
    initials: 'PM',
    hue: 220,
    specialty: 'Endocrinologia',
    primaryClinic: 'Clínica Bem Estar',
    crm: 'CRM-SP 789012',
    distanceKm: 0.8,
    isPriority: false,
  ),
  Doctor(
    id: 'd8',
    name: 'Dr. Gustavo Barbosa',
    initials: 'GB',
    hue: 50,
    specialty: 'Cardiologia',
    primaryClinic: 'Hospital e Maternidade São Luiz',
    crm: 'CRM-SP 890123',
    distanceKm: 2.1,
    isPriority: false,
  ),
  Doctor(
    id: 'd9',
    name: 'Dra. Camila Ribeiro',
    initials: 'CR',
    hue: 190,
    specialty: 'Ortopedia',
    primaryClinic: 'Clínica do Coração',
    crm: 'CRM-SP 901234',
    distanceKm: 14.7,
    isPriority: true,
  ),
  Doctor(
    id: 'd10',
    name: 'Dr. Marcelo Teixeira',
    initials: 'MT',
    hue: 70,
    specialty: 'Dermatologia',
    primaryClinic: 'Centro Médico São Camilo',
    crm: 'CRM-SP 012345',
    distanceKm: 5.0,
    isPriority: false,
  ),
  Doctor(
    id: 'd11',
    name: 'Dra. Renata Fonseca',
    initials: 'RF',
    hue: 310,
    specialty: 'Pediatria',
    primaryClinic: 'Hospital São Paulo',
    crm: 'CRM-SP 112233',
    distanceKm: 1.2,
    isPriority: false,
  ),
  Doctor(
    id: 'd12',
    name: 'Dr. Thiago Nunes',
    initials: 'TN',
    hue: 130,
    specialty: 'Neurologia',
    primaryClinic: 'Clínica Vita',
    crm: 'CRM-SP 223344',
    distanceKm: 15.3,
    isPriority: false,
  ),
  Doctor(
    id: 'd13',
    name: 'Dra. Lúcia Andrade',
    initials: 'LA',
    hue: 250,
    specialty: 'Ginecologia',
    primaryClinic: 'Hospital São Lucas',
    crm: 'CRM-SP 334455',
    distanceKm: 1.2,
    isPriority: true,
  ),
  Doctor(
    id: 'd14',
    name: 'Dr. Ricardo Gomes',
    initials: 'RG',
    hue: 40,
    specialty: 'Endocrinologia',
    primaryClinic: 'Clínica Santa Maria',
    crm: 'CRM-SP 445566',
    distanceKm: 2.8,
    isPriority: false,
  ),
  Doctor(
    id: 'd15',
    name: 'Dra. Sandra Vieira',
    initials: 'SV',
    hue: 290,
    specialty: 'Cardiologia',
    primaryClinic: 'Policlínica Nossa Senhora Aparecida',
    crm: 'CRM-SP 556677',
    distanceKm: 6.1,
    isPriority: false,
  ),
];

// ── Mock clinic details ───────────────────────────────────────
final _clinicDetails = [
  ClinicDetail(
    id: 'c1',
    name: 'Hospital São Lucas',
    city: 'São Paulo, SP',
    neighborhood: 'Vila Mariana',
    streetAddress: 'Rua Dr. Amâncio de Carvalho, 113',
    distanceKm: 1.2,
    status: ClinicStatus.ativa,
    lastVisitDays: 5,
    doctorCount: 12,
    isPriority: true,
    products: ['AtlasGel', 'AtlasCaps', 'AtlasSpray'],
    phone: '(11) 5084-1200',
    whatsapp: '(11) 99723-4455',
    consultantName: 'Rafael Melo',
    clientType: 'Key Account',
    region: 'Zona Sul',
    ltv: 48500,
    avgTicket: 3200,
    avgPurchaseDays: 45,
    fieldNotes: 'Dr. Carlos solicita visita mensal. Portaria exige agendamento com 48h de antecedência. Preferência por entregas na terça-feira pela manhã.',
    cnpj: '62.458.877/0001-90',
    email: 'adm@hospital-saolucas.com.br',
    website: 'www.hospitalsaolucas.com.br',
    responsibleDoctor: 'Dr. Fernando Almeida (CRM-SP 123456)',
    openingHours: 'Seg-Sex 07h-20h | Sáb 08h-16h',
    registeredSince: DateTime(2019, 3, 15),
    segment: 'Hospital Privado',
    signals: [
      ClinicSignal(type: 'warning', message: 'Faturamento caiu 15% no último trimestre'),
      ClinicSignal(type: 'info', message: 'Novo médico contratado: Dr. Ricardo Lopes (Cardiologista)'),
    ],
    productPerformance: [
      ProductPerformance(name: 'AtlasGel', trend: 'up', percentageChange: 12.5, share: 45),
      ProductPerformance(name: 'AtlasCaps', trend: 'down', percentageChange: 8.3, share: 30),
      ProductPerformance(name: 'AtlasSpray', trend: 'up', percentageChange: 22.1, share: 25),
    ],
    payers: [
      PayerInfo(name: 'Unimed', percentage: 40),
      PayerInfo(name: 'Bradesco Saúde', percentage: 25),
      PayerInfo(name: 'SulAmérica', percentage: 20),
      PayerInfo(name: 'Amil', percentage: 10),
      PayerInfo(name: 'Outros', percentage: 5),
    ],
    visits: [
      ClinicVisit(
        date: DateTime(2026, 6, 14),
        type: 'visita',
        summary: 'Apresentação do AtlasSpray. Dr. Carlos interessado. Agendado pedido experimental.',
        consultantName: 'Rafael Melo',
        hasPendingOrder: true,
      ),
      ClinicVisit(
        date: DateTime(2026, 6, 7),
        type: 'entrega',
        summary: 'Entrega de 50 unidades AtlasGel. Recebido por Maria (almoxarifado).',
        consultantName: 'Rafael Melo',
      ),
      ClinicVisit(
        date: DateTime(2026, 5, 28),
        type: 'visita',
        summary: 'Revisão de estoque. Renovação de contrato anual. Inclusão de AtlasSpray.',
        consultantName: 'Rafael Melo',
      ),
      ClinicVisit(
        date: DateTime(2026, 5, 10),
        type: 'retorno',
        summary: 'Devolução de 5 unidades AtlasCaps (lote vencido). Crédito concedido.',
        consultantName: 'Rafael Melo',
      ),
    ],
    clinicDoctors: [
      DoctorInfo(id: 'd1', name: 'Dra. Ana Beatriz Oliveira', initials: 'AB', hue: 210, specialty: 'Cardiologia', crm: 'CRM-SP 123456', isKeyOpinionLeader: true, hasPendingInteraction: true),
      DoctorInfo(id: 'd2', name: 'Dr. Carlos Eduardo Santos', initials: 'CE', hue: 340, specialty: 'Ortopedia', crm: 'CRM-SP 234567'),
      DoctorInfo(id: 'd13', name: 'Dra. Lúcia Andrade', initials: 'LA', hue: 250, specialty: 'Ginecologia', crm: 'CRM-SP 334455', isKeyOpinionLeader: true),
    ],
    nearbyClinics: [
      NearbyClinic(id: 'c7', name: 'Clínica Bem Estar', distanceKm: 0.8),
      NearbyClinic(id: 'c2', name: 'Clínica Santa Maria', distanceKm: 2.8),
      NearbyClinic(id: 'c8', name: 'Hospital São Luiz', distanceKm: 2.1),
    ],
  ),
  ClinicDetail(
    id: 'c2',
    name: 'Clínica Santa Maria',
    city: 'São Paulo, SP',
    neighborhood: 'Moema',
    streetAddress: 'Av. Jandira, 550',
    distanceKm: 2.8,
    status: ClinicStatus.ativa,
    lastVisitDays: 18,
    doctorCount: 8,
    isPriority: false,
    products: ['AtlasGel', 'AtlasCaps'],
    phone: '(11) 5055-7800',
    whatsapp: '(11) 98844-3311',
    consultantName: 'Rafael Melo',
    clientType: 'Conta Estratégica',
    region: 'Zona Sul',
    ltv: 28200,
    avgTicket: 1800,
    avgPurchaseDays: 60,
    fieldNotes: 'Preferência por contato via WhatsApp. Dra. Marina é a prescritora principal. Clínica fecha para almoço 12h-14h.',
    cnpj: '15.233.488/0001-20',
    email: 'adm@clinicasantamaria.com.br',
    registeredSince: DateTime(2020, 7, 1),
    segment: 'Clínica Privada',
    signals: [
      ClinicSignal(type: 'success', message: 'Meta de prescrições atingida 3 meses consecutivos'),
    ],
    productPerformance: [
      ProductPerformance(name: 'AtlasGel', trend: 'up', percentageChange: 8.2, share: 60),
      ProductPerformance(name: 'AtlasCaps', trend: 'stable', percentageChange: 1.5, share: 40),
    ],
    payers: [
      PayerInfo(name: 'Unimed', percentage: 50),
      PayerInfo(name: 'SulAmérica', percentage: 30),
      PayerInfo(name: 'Outros', percentage: 20),
    ],
    visits: [
      ClinicVisit(
        date: DateTime(2026, 6, 1),
        type: 'visita',
        summary: 'Renovação de estoque AtlasGel. Dra. Marina satisfeita com resultados.',
        consultantName: 'Rafael Melo',
      ),
      ClinicVisit(
        date: DateTime(2026, 5, 15),
        type: 'entrega',
        summary: 'Entrega de 30 unidades AtlasGel + 20 AtlasCaps.',
        consultantName: 'Rafael Melo',
      ),
    ],
    clinicDoctors: [
      DoctorInfo(id: 'd3', name: 'Dra. Marina Costa', initials: 'MC', hue: 160, specialty: 'Dermatologia', crm: 'CRM-SP 345678'),
      DoctorInfo(id: 'd14', name: 'Dr. Ricardo Gomes', initials: 'RG', hue: 40, specialty: 'Endocrinologia', crm: 'CRM-SP 445566'),
    ],
    nearbyClinics: [
      NearbyClinic(id: 'c1', name: 'Hospital São Lucas', distanceKm: 1.5),
      NearbyClinic(id: 'c6', name: 'Hospital Samaritano', distanceKm: 0.9),
    ],
  ),
];

// ── Mock doctor details ────────────────────────────────────
final _doctorDetails = [
  DoctorDetail(
    id: 'd1',
    name: 'Dra. Ana Beatriz Oliveira',
    initials: 'AB',
    hue: 210,
    specialty: 'Cardiologia',
    crm: 'CRM-SP 123456',
    role: 'Decisora · Cardiologia',
    distanceKm: 1.2,
    phone: '(11) 98844-2107',
    email: 'ana.oliveira@saolucas.com.br',
    whatsapp: '(11) 98844-2107',
    birthday: '22 de março · 52 anos',
    faculty: 'UNIFESP — Medicina · 2002',
    residency: 'Residência INCOR · Cardiologia (2008)',
    team: 'Corinthians',
    interests: 'Yoga · vinho tinto · fotografia',
    language: 'Português · Inglês · Francês',
    statusLabel: 'Decisora',
    statusColor: 0xFF1e40af,
    statusBg: 0x1F1e40af,
    relationshipLabel: 'Aberta',
    relationshipColor: 0xFF16a373,
    relationshipBg: 0x1F16a373,
    gallery: [
      DoctorPhoto(label: 'Perfil', date: 'mar/2026', hue: 210),
      DoctorPhoto(label: 'Cartão de visita', date: 'jan/2026', hue: 218),
      DoctorPhoto(label: 'Congresso SOCESP', date: 'nov/2025', hue: 148),
    ],
    signals: [
      DoctorSignal(kind: 'good', title: 'Crescimento na prescrição de AtlasGel', body: '+32% nos últimos 90 dias. Reforçar com material de evidências.'),
      DoctorSignal(kind: 'info', title: 'Aniversário em 22 de março', body: 'Enviar mensagem e brinde personalizado.'),
      DoctorSignal(kind: 'warn', title: 'Preferência por contato por e-mail', body: 'Não atende ligações durante consultas.'),
    ],
    prescribing: [
      DoctorPrescribingItem(product: 'AtlasGel', volume: 'R\$ 72.400', trend: [18, 22, 28, 32, 36, 40], growth: 32, share: 68),
      DoctorPrescribingItem(product: 'CardioFlex', volume: 'R\$ 18.200', trend: [12, 14, 16, 15, 18, 20], growth: 18, share: 22),
      DoctorPrescribingItem(product: 'AtlasCaps', volume: 'R\$ 6.100', trend: [4, 5, 4, 5, 6, 7], growth: 8, share: 10, isNew: true),
    ],
    clinics: [
      DoctorClinic(id: 'c1', name: 'Hospital São Lucas', role: 'Principal · 4 dias/sem', days: 'Seg · Ter · Qua · Qui', isMain: true),
      DoctorClinic(id: 'c6', name: 'Hospital Samaritano', role: 'Secundária · 1 dia/sem', days: 'Sextas'),
    ],
    visits: [
      DoctorVisit(date: '15/jun · seg', time: '10h30', duration: '35 min', consultant: 'Rafael Melo', consultantHue: 220, consultantInitials: 'RM', kind: 'Reunião agendada', location: 'Hospital São Lucas', note: 'Apresentei novo material de suporte clínico para AtlasGel. Muito receptiva — pediu amostras para 10 pacientes. Interessada em participar de estudo.', outcome: 'positivo', samples: ['AtlasGel 240g · 10un']),
      DoctorVisit(date: '12/mai · ter', time: '14h00', duration: '50 min', consultant: 'Rafael Melo', consultantHue: 220, consultantInitials: 'RM', kind: 'Fechamento de pedido', location: 'Hospital São Lucas', note: 'Fechou pedido de R\$ 5.800. Satisfeita com os resultados do AtlasGel nos pacientes.', outcome: 'positivo', orderValue: 'R\$ 5.800'),
      DoctorVisit(date: '10/abr · qua', time: '09h20', duration: '42 min', consultant: 'Rafael Melo', consultantHue: 220, consultantInitials: 'RM', kind: 'Follow-up congresso', location: 'Hospital Samaritano', note: 'Follow-up do SOCESP 2025. Comentou sobre novo artigo de cardiologia preventiva. Sugeri trial do CardioFlex.', outcome: 'misto', samples: ['CardioFlex · trial']),
      DoctorVisit(date: '08/mar · sex', time: '11h15', duration: '30 min', consultant: 'Rafael Melo', consultantHue: 220, consultantInitials: 'RM', kind: 'Visita rápida', location: 'Hospital São Lucas', note: 'Passou rapidamente no consultório. Confirmou presença no jantar de final de ano.', outcome: 'neutro'),
    ],
    notes: [
      'Prefere contato por e-mail. Não atende ligações durante consultas (07h-12h e 14h-18h).',
      'Filho mais novo faz faculdade de medicina — sempre perguntar como ele está.',
      'É da banca do SOCESP — bom canal para eventos e congressos.',
      'Adora vinho tinto (Malbec). Aniversário em 22/03.',
    ],
  ),
  DoctorDetail(
    id: 'd6',
    name: 'Dr. Fernando Pereira',
    initials: 'FP',
    hue: 100,
    specialty: 'Neurologia',
    crm: 'CRM-SP 678901',
    role: 'Prescritor · Neurologia',
    distanceKm: 3.2,
    phone: '(11) 99912-8877',
    email: 'fernando.pereira@samaritano.com.br',
    birthday: '5 de setembro · 45 anos',
    faculty: 'USP — Medicina · 2005',
    residency: 'Residência HCFMUSP · Neurologia (2011)',
    team: 'São Paulo',
    interests: 'Corrida · jazz · gastronomia',
    language: 'Português · Inglês · Alemão',
    statusLabel: 'Prescritor',
    statusColor: 0xFF16a373,
    statusBg: 0x1F16a373,
    relationshipLabel: 'Fiel',
    relationshipColor: 0xFF16a373,
    relationshipBg: 0x1F16a373,
    gallery: [
      DoctorPhoto(label: 'Perfil', date: 'fev/2026', hue: 100),
      DoctorPhoto(label: 'Cartão de visita', date: 'set/2025', hue: 90),
    ],
    signals: [
      DoctorSignal(kind: 'good', title: 'Fidelidade AtlasMed', body: 'Prescreve exclusivamente nossos produtos há 3 anos. Renovar parceria.'),
      DoctorSignal(kind: 'info', title: 'Maratona em 60 dias', body: 'Treinando para a Maratona de SP. Enviar kit de hidratação.'),
    ],
    prescribing: [
      DoctorPrescribingItem(product: 'AtlasGel', volume: 'R\$ 43.200', trend: [32, 34, 36, 38, 40, 42], growth: 8, share: 85),
      DoctorPrescribingItem(product: 'NeuroFlex', volume: 'R\$ 12.800', trend: [8, 10, 12, 12, 14, 15], growth: 22, share: 15, isNew: true),
    ],
    clinics: [
      DoctorClinic(id: 'c6', name: 'Hospital Samaritano', role: 'Principal · 3 dias/sem', days: 'Seg · Qua · Sex', isMain: true),
    ],
    visits: [
      DoctorVisit(date: '10/jun · ter', time: '08h30', duration: '45 min', consultant: 'Rafael Melo', consultantHue: 220, consultantInitials: 'RM', kind: 'Visita mensal', location: 'Hospital Samaritano', note: 'Rotina mensal. Renovação de estoque AtlasGel. Mencionou interesse em trial de nova formulação.', outcome: 'positivo', samples: ['AtlasGel 240g · 5un']),
      DoctorVisit(date: '12/mai · seg', time: '09h00', duration: '30 min', consultant: 'Rafael Melo', consultantHue: 220, consultantInitials: 'RM', kind: 'Entrega de amostras', location: 'Hospital Samaritano', note: 'Entrega de amostras solicitadas no mês anterior.', outcome: 'positivo', samples: ['AtlasGel 240g · 8un', 'NeuroFlex · trial']),
      DoctorVisit(date: '18/abr · qua', time: '10h00', duration: '55 min', consultant: 'Rafael Melo', consultantHue: 220, consultantInitials: 'RM', kind: 'Almoço de negócios', location: 'Restaurante Dona Firmina', note: 'Almoço de alinhamento estratégico. Discutimos plano anual e metas de prescrição.', outcome: 'positivo'),
    ],
    notes: [
      'Fiel absoluto — único prescritor de Neurologia no Samaritano.',
      'Corredor amador. Sempre perguntar sobre treinos e provas.',
      'Prefere contato sempre pelo WhatsApp. Responde rápido.',
    ],
  ),
  DoctorDetail(
    id: 'd4',
    name: 'Dr. Roberto Almeida',
    initials: 'RA',
    hue: 30,
    specialty: 'Pediatria',
    crm: 'CRM-SP 456789',
    role: 'Influenciador · Pediatria',
    distanceKm: 4.5,
    phone: '(11) 97765-4321',
    email: 'roberto.almeida@einstein.com.br',
    birthday: '30 de novembro · 41 anos',
    faculty: 'UNICAMP — Medicina · 2007',
    residency: 'Residência UNICAMP · Pediatria (2013)',
    team: 'Flamengo',
    interests: 'Futebol · churrasco · seriados',
    language: 'Português · Espanhol',
    statusLabel: 'Influenciador',
    statusColor: 0xFF7c3aed,
    statusBg: 0x1F7c3aed,
    relationshipLabel: 'Em desenvolvimento',
    relationshipColor: 0xFFc6861b,
    relationshipBg: 0x1Fc6861b,
    gallery: [
      DoctorPhoto(label: 'Perfil', date: 'jan/2026', hue: 30),
      DoctorPhoto(label: 'Cartão de visita', date: 'jan/2026', hue: 218),
    ],
    signals: [
      DoctorSignal(kind: 'good', title: 'Novo prescritor de AtlasDerm', body: 'Iniciou prescrição há 60 dias. Crescimento promissor.'),
      DoctorSignal(kind: 'info', title: 'Aniversário em 30/11', body: ' Preparar brinde personalizado. Fã de futebol.'),
      DoctorSignal(kind: 'warn', title: 'Restrição de visitas às quintas', body: 'Atende em outra clínica. Preferência por terças ou sextas.'),
    ],
    prescribing: [
      DoctorPrescribingItem(product: 'AtlasGel', volume: 'R\$ 22.800', trend: [8, 10, 14, 18, 20, 22], growth: 45, share: 55),
      DoctorPrescribingItem(product: 'AtlasDerm', volume: 'R\$ 9.400', trend: [0, 0, 0, 2, 4, 8], growth: 100, share: 25, isNew: true),
      DoctorPrescribingItem(product: 'AtlasCaps', volume: 'R\$ 4.200', trend: [3, 4, 3, 4, 4, 3], growth: -10, share: 20),
    ],
    clinics: [
      DoctorClinic(id: 'c3', name: 'Centro Médico Albert Einstein', role: 'Principal · 4 dias/sem', days: 'Seg · Ter · Qua · Sex', isMain: true),
    ],
    visits: [
      DoctorVisit(date: '12/jun · qua', time: '15h00', duration: '40 min', consultant: 'Rafael Melo', consultantHue: 220, consultantInitials: 'RM', kind: 'Visita pedagógica', location: 'Centro Médico Albert Einstein', note: 'Apresentei resultados de estudo pediátrico do AtlasGel. Muito interessado — pediu literatura para compartilhar com colegas.', outcome: 'positivo', samples: ['AtlasGel 120g · 8un']),
      DoctorVisit(date: '08/mai · sex', time: '11h30', duration: '25 min', consultant: 'Rafael Melo', consultantHue: 220, consultantInitials: 'RM', kind: 'Follow-up', location: 'Centro Médico Albert Einstein', note: 'Rápido follow-up. Confirmou que AtlasDerm está funcionando bem. Solicitou mais material.', outcome: 'positivo', samples: ['AtlasDerm · 5un']),
    ],
    notes: [
      'Prescritor novo (AtlasDerm). Acompanhar de perto nos próximos 90 dias.',
      'Evitar visitas às quintas (atende em outra clínica).',
      'Grande influenciador na Pediatria — outros residentes o seguem.',
    ],
  ),
];
