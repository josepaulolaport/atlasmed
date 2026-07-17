import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Mock CRM pool of doctors that can be associated to a facility.
/// Phase 1 — no search API yet.
List<FacilityCrmDoctor> mockAssociableDoctors() => const [
  FacilityCrmDoctor(
    id: 'pool-doc-1',
    name: 'Dr. Ricardo Abdalla Bittar',
    initials: 'RB',
    hue: 12,
    specialty: 'Ortopedia',
    crm: 'CRM/SP 74.127',
    phone: '11990001111',
    email: 'ricardo.bittar@exemplo.com',
    isPrescriber: true,
  ),
  FacilityCrmDoctor(
    id: 'pool-doc-2',
    name: 'Dra. Camila Nogueira',
    initials: 'CN',
    hue: 280,
    specialty: 'Dermatologia',
    crm: 'CRM/SP 55.320',
    phone: '11990002222',
    isPrescriber: true,
    isDecisionMaker: true,
  ),
  FacilityCrmDoctor(
    id: 'pool-doc-3',
    name: 'Dr. André Luiz Campos',
    initials: 'AC',
    hue: 200,
    specialty: 'Cardiologia',
    crm: 'CRM/SP 88.901',
    phone: '11990003333',
    isBuyer: true,
  ),
  FacilityCrmDoctor(
    id: 'pool-doc-4',
    name: 'Dra. Beatriz Moura',
    initials: 'BM',
    hue: 40,
    specialty: 'Pediatria',
    crm: 'CRM/SP 61.448',
    email: 'beatriz.moura@exemplo.com',
    isPrescriber: true,
  ),
  FacilityCrmDoctor(
    id: 'pool-doc-5',
    name: 'Dr. Felipe Santos',
    initials: 'FS',
    hue: 150,
    specialty: 'Neurologia',
    crm: 'CRM/SP 33.210',
    phone: '11990005555',
  ),
];

/// Mock pool of administrative contacts available to associate.
List<AdministrativeProfessional> mockAssociableProfessionals() => const [
  AdministrativeProfessional(
    id: 'pool-adm-1',
    name: 'Juliana Prado',
    roleTitle: 'Gerente administrativa',
    email: 'juliana.prado@exemplo.com',
    phone: '11981112222',
    contactType: 'DECISOR',
  ),
  AdministrativeProfessional(
    id: 'pool-adm-2',
    name: 'Marcos Vieira',
    roleTitle: 'Compras',
    email: 'marcos.vieira@exemplo.com',
    phone: '11983334444',
    contactType: 'COMPRADOR',
  ),
  AdministrativeProfessional(
    id: 'pool-adm-3',
    name: 'Patrícia Gomes',
    roleTitle: 'Secretária clínica',
    phone: '11985556666',
    contactType: 'PROFESSIONAL',
  ),
  AdministrativeProfessional(
    id: 'pool-adm-4',
    name: 'Roberto Dias',
    roleTitle: 'Diretor financeiro',
    email: 'roberto.dias@exemplo.com',
    contactType: 'DECISOR',
  ),
];

String initialsFromName(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.length >= 2) {
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }
  return name.isNotEmpty ? name[0].toUpperCase() : '?';
}

double hueFromName(String name) => (name.hashCode.abs() % 360).toDouble();
