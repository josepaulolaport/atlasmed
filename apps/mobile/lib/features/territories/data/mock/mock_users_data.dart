import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';

// ======================================================================
// Mirrors the manager/rep names already seeded onto `mockTerritories` in
// `mock_territories_data.dart` (Fernanda Duarte, Bruno Castro, ...) so
// the viewer's existing "Representante: Fulano" cards resolve to a real
// `AppUser` once territories reference `assignedUserId` instead of a raw
// name string. A few extra, still-unassigned users are added so the
// assignment picker has real candidates to offer beyond whoever a
// territory already happens to have.
// ======================================================================

const mockUsers = <AppUser>[
  // Oncologia
  AppUser(
    id: 'user-fernanda-duarte',
    name: 'Fernanda Duarte',
    role: UserRole.manager,
    sectorId: 'sector-oncologia',
  ),
  AppUser(
    id: 'user-marcos-lima',
    name: 'Marcos Lima',
    role: UserRole.manager,
    sectorId: 'sector-oncologia',
  ),
  AppUser(
    id: 'user-bruno-castro',
    name: 'Bruno Castro',
    role: UserRole.rep,
    sectorId: 'sector-oncologia',
  ),
  AppUser(
    id: 'user-camila-rocha',
    name: 'Camila Rocha',
    role: UserRole.rep,
    sectorId: 'sector-oncologia',
  ),
  AppUser(
    id: 'user-diego-farias',
    name: 'Diego Farias',
    role: UserRole.rep,
    sectorId: 'sector-oncologia',
  ),
  AppUser(
    id: 'user-juliana-pires',
    name: 'Juliana Pires',
    role: UserRole.rep,
    sectorId: 'sector-oncologia',
  ),
  AppUser(
    id: 'user-lucas-tavares',
    name: 'Lucas Tavares',
    role: UserRole.rep,
    sectorId: 'sector-oncologia',
  ),
  // Extra, not yet assigned to any territory.
  AppUser(
    id: 'user-heloisa-martins',
    name: 'Heloísa Martins',
    role: UserRole.rep,
    sectorId: 'sector-oncologia',
  ),

  // Cardiologia
  AppUser(
    id: 'user-renata-souza',
    name: 'Renata Souza',
    role: UserRole.manager,
    sectorId: 'sector-cardiologia',
  ),
  AppUser(
    id: 'user-eduardo-alves',
    name: 'Eduardo Alves',
    role: UserRole.manager,
    sectorId: 'sector-cardiologia',
  ),
  AppUser(
    id: 'user-patricia-gomes',
    name: 'Patrícia Gomes',
    role: UserRole.rep,
    sectorId: 'sector-cardiologia',
  ),
  AppUser(
    id: 'user-rafael-nogueira',
    name: 'Rafael Nogueira',
    role: UserRole.rep,
    sectorId: 'sector-cardiologia',
  ),
  AppUser(
    id: 'user-talita-ramos',
    name: 'Talita Ramos',
    role: UserRole.rep,
    sectorId: 'sector-cardiologia',
  ),
  AppUser(
    id: 'user-vinicius-prado',
    name: 'Vinícius Prado',
    role: UserRole.rep,
    sectorId: 'sector-cardiologia',
  ),
  // Extra, not yet assigned to any territory.
  AppUser(
    id: 'user-otavio-barros',
    name: 'Otávio Barros',
    role: UserRole.manager,
    sectorId: 'sector-cardiologia',
  ),
  AppUser(
    id: 'user-carla-medeiros',
    name: 'Carla Medeiros',
    role: UserRole.rep,
    sectorId: 'sector-cardiologia',
  ),
];
