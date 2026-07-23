import 'package:atlasmed_mobile_app/features/users/data/mock/mock_assignment_options_data.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_sector_assignment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';

DateTime _d(int daysAgo) =>
    DateTime(2026, 7, 17).subtract(Duration(days: daysAgo));
DateTime _plus(int days) => DateTime(2026, 7, 17).add(Duration(days: days));

TerritoryOption _territory(String id) =>
    mockTerritoryOptions.firstWhere((t) => t.id == id);

/// Static seed data standing in for `GET /access/invitations`.
final mockInvitations = <UserInvitation>[
  UserInvitation(
    id: 'invite-1',
    email: 'novo.representante@atlasmed.com.br',
    firstName: 'Rafael',
    lastName: 'Mendes',
    birthDate: DateTime(1992, 4, 18),
    phoneNumber: '+55 11 98765-4321',
    roleId: 'role-rep',
    roleName: 'REP',
    status: InvitationStatus.pending,
    invitedByName: 'Ana Beatriz',
    managerName: 'Fernanda Duarte',
    territoryName: '2 territórios',
    sectorAssignments: [
      InviteSectorAssignment(
        sectorId: 'sector-oncologia',
        sectorName: 'Oncologia',
        managerId: 'user-fernanda-duarte',
        managerName: 'Fernanda Duarte',
        territories: [
          _territory('territory-sul-onco-b'),
          _territory('territory-sul-onco-c'),
        ],
      ),
    ],
    createdAt: _d(2),
    expiresAt: _plus(5),
    resendCount: 0,
  ),
  UserInvitation(
    id: 'invite-2',
    email: 'gerente.novo@atlasmed.com.br',
    firstName: 'Carla',
    lastName: 'Nogueira',
    birthDate: DateTime(1987, 11, 3),
    phoneNumber: '+55 11 97654-3210',
    roleId: 'role-manager',
    roleName: 'MANAGER',
    status: InvitationStatus.pending,
    invitedByName: 'Ana Beatriz',
    territoryName: 'Centro Onco A — República',
    sectorAssignments: [
      InviteSectorAssignment(
        sectorId: 'sector-oncologia',
        sectorName: 'Oncologia',
        territories: [_territory('territory-centro-onco-a')],
      ),
    ],
    createdAt: _d(1),
    expiresAt: _plus(6),
    resendCount: 1,
  ),
  UserInvitation(
    id: 'invite-3',
    email: 'antigo.convite@atlasmed.com.br',
    firstName: 'Tiago',
    lastName: 'Ribeiro',
    birthDate: DateTime(1990, 8, 25),
    phoneNumber: '+55 11 96543-2109',
    roleId: 'role-rep',
    roleName: 'REP',
    status: InvitationStatus.expired,
    invitedByName: 'Fernanda Duarte',
    managerName: 'Marcos Lima',
    territoryName: 'Norte Onco B — Tucuruvi',
    sectorAssignments: [
      InviteSectorAssignment(
        sectorId: 'sector-oncologia',
        sectorName: 'Oncologia',
        managerId: 'user-marcos-lima',
        managerName: 'Marcos Lima',
        territories: [_territory('territory-norte-onco-b')],
      ),
    ],
    createdAt: _d(20),
    expiresAt: _d(13),
    resendCount: 2,
  ),
  UserInvitation(
    id: 'invite-4',
    email: 'revogado@atlasmed.com.br',
    firstName: 'Sofia',
    lastName: 'Almeida',
    birthDate: DateTime(1995, 2, 9),
    phoneNumber: '+55 11 95432-1098',
    roleId: 'role-ops',
    roleName: 'OPS',
    status: InvitationStatus.revoked,
    invitedByName: 'Ana Beatriz',
    createdAt: _d(15),
    expiresAt: _d(8),
    resendCount: 0,
  ),
  UserInvitation(
    id: 'invite-5',
    email: 'aceito.recente@atlasmed.com.br',
    firstName: 'Pedro',
    lastName: 'Vasconcelos',
    birthDate: DateTime(1988, 6, 14),
    phoneNumber: '+55 11 94321-0987',
    roleId: 'role-rep',
    roleName: 'REP',
    status: InvitationStatus.accepted,
    invitedByName: 'Renata Souza',
    managerName: 'Eduardo Alves',
    territoryName: 'Oeste Cardio A — Pinheiros',
    sectorAssignments: [
      InviteSectorAssignment(
        sectorId: 'sector-cardiologia',
        sectorName: 'Cardiologia',
        managerId: 'user-eduardo-alves',
        managerName: 'Eduardo Alves',
        territories: [_territory('territory-oeste-cardio-a')],
      ),
    ],
    createdAt: _d(30),
    expiresAt: _d(23),
    resendCount: 0,
  ),
];
