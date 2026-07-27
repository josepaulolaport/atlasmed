import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/utils/date_format.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class InvitationsScreen extends ConsumerWidget {
  const InvitationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invitationsAsync = ref.watch(invitationsListProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(
                      Icons.arrow_back_rounded,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                  const Text(
                    'Convites',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: invitationsAsync.when(
                loading: () => const InvitationListSkeleton(),
                error: (_, _) => const Center(
                  child: Text(
                    'Não foi possível carregar os convites.',
                    style: TextStyle(color: Color(0xFF6b7280)),
                  ),
                ),
                data: (invitations) {
                  if (invitations.isEmpty) {
                    return const Center(
                      child: Text(
                        'Nenhum convite enviado ainda.',
                        style: TextStyle(color: Color(0xFF6b7280)),
                      ),
                    );
                  }
                  return RefreshIndicator(
                    onRefresh: () async =>
                        ref.invalidate(invitationsListProvider),
                    child: ListView.builder(
                      padding: const EdgeInsets.only(bottom: 24),
                      itemCount: invitations.length,
                      itemBuilder: (context, index) =>
                          _InvitationRow(invitation: invitations[index]),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InvitationRow extends ConsumerWidget {
  const _InvitationRow({required this.invitation});

  final UserInvitation invitation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canAct = invitation.status == InvitationStatus.pending;

    return Material(
      color: Colors.white,
      child: InkWell(
        onTap: () => context.push('/users/invitations/${invitation.id}'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      invitation.displayName,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0f1729),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      invitation.email,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFF0a2f7f,
                            ).withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            invitation.roleName,
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0a2f7f),
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: invitation.status.color.withValues(
                              alpha: 0.12,
                            ),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            invitation.status.label,
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: invitation.status.color,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Expira em ${formatDate(invitation.expiresAt)} · '
                      'convidado por ${invitation.invitedByName}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF9ca3af),
                      ),
                    ),
                  ],
                ),
              ),
              if (canAct)
                PopupMenuButton<String>(
                  icon: const Icon(
                    Icons.more_vert_rounded,
                    color: Color(0xFF6b7280),
                  ),
                  onSelected: (action) => _handleAction(context, ref, action),
                  itemBuilder: (context) => const [
                    PopupMenuItem(value: 'resend', child: Text('Reenviar')),
                    PopupMenuItem(value: 'revoke', child: Text('Revogar')),
                  ],
                )
              else
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFF9ca3af),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleAction(
    BuildContext context,
    WidgetRef ref,
    String action,
  ) async {
    final repository = ref.read(invitationsRepositoryProvider);
    try {
      if (action == 'resend') {
        await repository.resendInvitation(invitation.id);
      } else if (action == 'revoke') {
        await repository.revokeInvitation(invitation.id);
      }
      ref.invalidate(invitationsListProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              action == 'resend' ? 'Convite reenviado.' : 'Convite revogado.',
            ),
          ),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível concluir a ação.')),
        );
      }
    }
  }
}
