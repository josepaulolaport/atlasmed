import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';

DateTime _d(int daysAgo) =>
    DateTime(2026, 7, 17).subtract(Duration(days: daysAgo));
DateTime _plus(int days) => DateTime(2026, 7, 17).add(Duration(days: days));

/// Static seed data standing in for `GET /access/invitations`.
final mockInvitations = <UserInvitation>[
  UserInvitation(
    id: 'invite-1',
    email: 'novo.representante@atlasmed.com.br',
    roleName: 'REP',
    status: InvitationStatus.pending,
    invitedByName: 'Ana Beatriz',
    managerName: 'Fernanda Duarte',
    territoryName: 'Zona Sul — Oncologia',
    createdAt: _d(2),
    expiresAt: _plus(5),
    resendCount: 0,
  ),
  UserInvitation(
    id: 'invite-2',
    email: 'gerente.novo@atlasmed.com.br',
    roleName: 'MANAGER',
    status: InvitationStatus.pending,
    invitedByName: 'Ana Beatriz',
    createdAt: _d(1),
    expiresAt: _plus(6),
    resendCount: 1,
  ),
  UserInvitation(
    id: 'invite-3',
    email: 'antigo.convite@atlasmed.com.br',
    roleName: 'REP',
    status: InvitationStatus.expired,
    invitedByName: 'Fernanda Duarte',
    managerName: 'Fernanda Duarte',
    territoryName: 'Zona Norte — Oncologia',
    createdAt: _d(20),
    expiresAt: _d(13),
    resendCount: 2,
  ),
  UserInvitation(
    id: 'invite-4',
    email: 'revogado@atlasmed.com.br',
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
    roleName: 'REP',
    status: InvitationStatus.accepted,
    invitedByName: 'Renata Souza',
    managerName: 'Renata Souza',
    territoryName: 'Zona Leste — Cardiologia',
    createdAt: _d(30),
    expiresAt: _d(23),
    resendCount: 0,
  ),
];
