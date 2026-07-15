import '../models/models.dart';
import '../models/order.dart';
import '../models/cart.dart';
import '../models/tracking.dart';

// ── Mock products ───────────────────────────────────────────
const kProducts = [
  Product(
    id: 'p1',
    name: 'AtlasGel',
    sub: 'Gel ortopédico · 240g',
    unit: 89.90,
    category: 'Ortopedia',
    tag: 'top',
  ),
  Product(
    id: 'p2',
    name: 'AtlasDerm',
    sub: 'Creme dermatológico · 60g',
    unit: 124.50,
    category: 'Dermatologia',
  ),
  Product(
    id: 'p3',
    name: 'CardioFlex',
    sub: 'Suplemento cardiovascular · 30cp',
    unit: 67.80,
    category: 'Cardiologia',
  ),
  Product(
    id: 'p4',
    name: 'OrtoPlus',
    sub: 'Solução ortopédica · 100ml',
    unit: 145.00,
    category: 'Ortopedia',
    tag: 'novo',
  ),
  Product(
    id: 'p5',
    name: 'VitalScan',
    sub: 'Kit diagnóstico rápido',
    unit: 389.00,
    category: 'Diagnóstico',
    tag: 'premium',
  ),
  Product(
    id: 'p6',
    name: 'AtlasVit',
    sub: 'Vitaminas complexo B · 60cp',
    unit: 42.30,
    category: 'Suplementação',
  ),
  Product(
    id: 'p7',
    name: 'DermaShield',
    sub: 'Protetor dermatológico · 50g',
    unit: 98.60,
    category: 'Dermatologia',
  ),
];

// ── Mock orders list ────────────────────────────────────────
const kOrdersList = [
  OrderListItem(
    id: 'PED-2041',
    clinic: 'Clínica Santa Mônica',
    doctor: 'Dra. Mariana Silva',
    date: '17 abr',
    value: 'R\$ 4.120',
    status: OrderStatus.transito,
    items: 3,
  ),
  OrderListItem(
    id: 'PED-2038',
    clinic: 'Centro Ortopédico Paulista',
    doctor: 'Dr. Paulo Cardoso',
    date: '14 abr',
    value: 'R\$ 1.780',
    status: OrderStatus.entregue,
    items: 2,
  ),
  OrderListItem(
    id: 'PED-2035',
    clinic: 'Instituto CardioMed',
    doctor: 'Dra. Fernanda Costa',
    date: '10 abr',
    value: 'R\$ 2.350',
    status: OrderStatus.entregue,
    items: 4,
  ),
  OrderListItem(
    id: 'PED-2029',
    clinic: 'Clínica Vitalis Itaim',
    doctor: 'Dr. Rafael Souza',
    date: '02 abr',
    value: 'R\$ 890',
    status: OrderStatus.pendente,
    items: 1,
  ),
  OrderListItem(
    id: 'PED-2021',
    clinic: 'Policlínica Primavera',
    doctor: 'Dra. Beatriz Lima',
    date: '24 mar',
    value: 'R\$ 3.640',
    status: OrderStatus.cancelado,
    items: 5,
  ),
];

// ── Mock order details ──────────────────────────────────────
final kOrdersDetail = {
  'PED-2041': OrderDetail(
    id: 'PED-2041',
    placedAt: '17 abr · 09:42',
    clinic: 'Clínica Santa Mônica',
    clinicAddress:
        'Av. Paulista, 1578 · Bela Vista · São Paulo, SP · 01310-200',
    doctor: 'Dra. Mariana Silva',
    doctorCrm: 'CRM-SP 148.732',
    status: OrderStatus.transito,
    items: const [
      OrderDetailItem(productId: 'p1', qty: 2),
      OrderDetailItem(productId: 'p4', qty: 1),
      OrderDetailItem(productId: 'p6', qty: 3),
    ],
    shipping: 0,
    paymentMethod: 'Faturado · 30 dias',
    invoice: 'NF-e 00148732',
    tracking: 'BR847291538LK',
    estimate: '19 a 22 de abril de 2026',
    timeline: const [
      TimelineStep(
        step: 'Pedido confirmado',
        date: '17 abr · 09:42',
        done: true,
      ),
      TimelineStep(step: 'Em separação', date: '17 abr · 14:20', done: true),
      TimelineStep(
        step: 'Em trânsito',
        date: '18 abr · 07:15',
        done: true,
        current: true,
      ),
      TimelineStep(
        step: 'Entregue',
        date: 'Previsto: 19 a 22 abr',
        done: false,
      ),
    ],
  ),
  'PED-2038': OrderDetail(
    id: 'PED-2038',
    placedAt: '14 abr · 11:08',
    clinic: 'Centro Ortopédico Paulista',
    clinicAddress: 'R. Augusta, 2410 · Jardins · São Paulo, SP · 01412-100',
    doctor: 'Dr. Paulo Cardoso',
    doctorCrm: 'CRM-SP 121.455',
    status: OrderStatus.entregue,
    items: const [
      OrderDetailItem(productId: 'p4', qty: 1),
      OrderDetailItem(productId: 'p2', qty: 1),
    ],
    shipping: 0,
    paymentMethod: 'Faturado · 30 dias',
    invoice: 'NF-e 00148605',
    tracking: 'BR847290224LK',
    estimate: 'Entregue em 16 de abril · 10:55',
    timeline: const [
      TimelineStep(
        step: 'Pedido confirmado',
        date: '14 abr · 11:08',
        done: true,
      ),
      TimelineStep(step: 'Em separação', date: '14 abr · 15:30', done: true),
      TimelineStep(step: 'Em trânsito', date: '15 abr · 08:12', done: true),
      TimelineStep(
        step: 'Entregue',
        date: '16 abr · 10:55',
        done: true,
        current: true,
      ),
    ],
  ),
};

// ── Mock tracking orders ────────────────────────────────────
final kTrackingOrders = {
  'ORD-2841': TrackingOrderDetail(
    id: 'ORD-2841',
    status: TrackingStatus.shipped,
    createdAt: '2026-05-05T10:30:00',
    estimatedDelivery: '2026-05-08',
    paymentMethod: 'Faturado · 30 dias',
    total: 'R\$ 8.420,00',
    clinic: const TrackingClinic(
      id: 'c-1',
      name: 'Clínica Santa Mônica',
      address: 'Av. Pinheiros, 410 — São Paulo, SP',
    ),
    items: const [
      TrackingOrderItem(
        id: 'i-1',
        productName: 'AtlasGel 50g',
        code: 'ATG-050',
        quantity: 30,
        unit: 'caixas',
        subtotal: 'R\$ 4.200,00',
      ),
      TrackingOrderItem(
        id: 'i-2',
        productName: 'AtlasVit Cardio',
        code: 'AVT-C20',
        quantity: 20,
        unit: 'caixas',
        subtotal: 'R\$ 2.840,00',
      ),
      TrackingOrderItem(
        id: 'i-3',
        productName: 'AtlasDerm Spray',
        code: 'ADS-150',
        quantity: 10,
        unit: 'frascos',
        subtotal: 'R\$ 1.380,00',
      ),
    ],
    timeline: const [
      TrackingEvent(
        status: TrackingStatus.confirmed,
        timestamp: '2026-05-05T10:32:00',
        description: 'Pedido confirmado e enviado ao centro de distribuição.',
      ),
      TrackingEvent(
        status: TrackingStatus.processing,
        timestamp: '2026-05-05T14:18:00',
        description: 'Pedido separado e embalado · CD São Paulo.',
      ),
      TrackingEvent(
        status: TrackingStatus.shipped,
        timestamp: '2026-05-07T08:05:00',
        description: 'Saiu para entrega · previsão para amanhã.',
      ),
    ],
    driver: const DriverInfo(
      name: 'Carlos Silva',
      vehicle: 'Fiat Strada · ABC-1J34',
      phone: '+55 11 98765-4321',
      rating: 4.9,
      eta: '14:30',
    ),
  ),
  'ORD-2839': TrackingOrderDetail(
    id: 'ORD-2839',
    status: TrackingStatus.processing,
    createdAt: '2026-05-07T09:12:00',
    estimatedDelivery: '2026-05-09',
    paymentMethod: 'Boleto bancário',
    total: 'R\$ 4.820,00',
    clinic: const TrackingClinic(
      id: 'c-2',
      name: 'Hospital Central',
      address: 'Rua Augusta, 500 — São Paulo, SP',
    ),
    items: const [
      TrackingOrderItem(
        id: 'i-1',
        productName: 'AtlasVit Cardio',
        code: 'AVT-C20',
        quantity: 30,
        unit: 'caixas',
        subtotal: 'R\$ 4.260,00',
      ),
      TrackingOrderItem(
        id: 'i-2',
        productName: 'AtlasDerm Spray',
        code: 'ADS-150',
        quantity: 5,
        unit: 'frascos',
        subtotal: 'R\$ 560,00',
      ),
    ],
    timeline: const [
      TrackingEvent(
        status: TrackingStatus.confirmed,
        timestamp: '2026-05-07T09:14:00',
        description: 'Pedido confirmado.',
      ),
      TrackingEvent(
        status: TrackingStatus.processing,
        timestamp: '2026-05-07T11:42:00',
        description: 'Pedido em separação no centro de distribuição.',
      ),
    ],
    driver: null,
  ),
};

// ── Price suggestions for ProductOrderSheet ──────────────────
PriceSuggestion? getSuggestedPrice(
  String clinicId,
  String productId,
  double catalogUnit,
) {
  // Simulate: Clinic 'c1' has history for product p1
  if (clinicId == 'c1' && productId == 'p1') {
    return PriceSuggestion(
      unit: 79.50,
      date: '2026-03-15',
      kind: 'recorrente',
      isDiscounted: true,
      discountPct: 12,
      history: const [
        PriceHistoryEntry(
          unit: 79.50,
          date: '2026-03-15',
          kind: 'recorrente',
          qty: 50,
          orderId: 'PED-1982',
        ),
        PriceHistoryEntry(
          unit: 82.00,
          date: '2025-12-10',
          kind: 'campanha',
          qty: 30,
          orderId: 'PED-1921',
        ),
        PriceHistoryEntry(
          unit: 89.90,
          date: '2025-09-05',
          kind: 'tabela',
          qty: 20,
          orderId: 'PED-1855',
        ),
      ],
    );
  }
  return null;
}

/// Mock clinics for checkout selector (reusing Clinic model shape).
class SelectableClinic {
  final String id;
  final String name;
  const SelectableClinic({required this.id, required this.name});
}

const kSelectorClinics = [
  SelectableClinic(id: 'c-0', name: 'Clínica Santa Mônica'),
  SelectableClinic(id: 'c-1', name: 'Hospital São Lucas'),
  SelectableClinic(id: 'c-2', name: 'Centro Ortopédico Paulista'),
  SelectableClinic(id: 'c-3', name: 'Instituto CardioMed'),
  SelectableClinic(id: 'c-4', name: 'Clínica Vitalis Itaim'),
];

class SelectableDoctor {
  final String id;
  final String name;
  final String specialty;
  final String clinicId;
  const SelectableDoctor({
    required this.id,
    required this.name,
    required this.specialty,
    required this.clinicId,
  });
}

final kSelectorDoctors = [
  const SelectableDoctor(
    id: 'd-0',
    name: 'Dra. Mariana Silva',
    specialty: 'Cardiologia',
    clinicId: 'c-0',
  ),
  const SelectableDoctor(
    id: 'd-1',
    name: 'Dr. Paulo Cardoso',
    specialty: 'Ortopedia',
    clinicId: 'c-1',
  ),
  const SelectableDoctor(
    id: 'd-2',
    name: 'Dra. Fernanda Costa',
    specialty: 'Cardiologia',
    clinicId: 'c-2',
  ),
  const SelectableDoctor(
    id: 'd-3',
    name: 'Dr. Rafael Souza',
    specialty: 'Pediatria',
    clinicId: 'c-3',
  ),
  const SelectableDoctor(
    id: 'd-4',
    name: 'Dra. Beatriz Lima',
    specialty: 'Dermatologia',
    clinicId: 'c-4',
  ),
  const SelectableDoctor(
    id: 'd-5',
    name: 'Dr. Carlos Eduardo',
    specialty: 'Ortopedia',
    clinicId: 'c-0',
  ),
  const SelectableDoctor(
    id: 'd-6',
    name: 'Dra. Lúcia Andrade',
    specialty: 'Ginecologia',
    clinicId: 'c-1',
  ),
];
