import 'package:atlasmed_mobile_app/features/users/presentation/widgets/confirm_revoke_dialog.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/invite_action_message.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:atlasmed_mobile_app/features/users/utils/date_format.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

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
                      color: AppColors.gray900,
                    ),
                  ),
                  const Text(
                    'Convites',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray900,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: invitationsAsync.when(
                loading: () => const InvitationListSkeleton(),
                error: (_, _) => _InvitationsMessage(
                  icon: Icons.cloud_off_rounded,
                  title: 'Não foi possível carregar os convites.',
                  description:
                      'Verifique sua conexão e tente de novo. Puxe para '
                      'atualizar.',
                  onRetry: () => ref.invalidate(invitationsListProvider),
                ),
                data: (invitations) {
                  // The empty and error states used to sit outside the
                  // RefreshIndicator, so the one screen where you most want to
                  // pull down — nothing here, did it not load? — was the one
                  // screen where pulling did nothing.
                  if (invitations.isEmpty) {
                    return _RefreshableBody(
                      onRefresh: () => ref.invalidate(invitationsListProvider),
                      child: const _InvitationsMessage(
                        icon: Icons.mark_email_read_outlined,
                        title: 'Nenhum convite enviado ainda.',
                        description:
                            'Convites aparecem aqui até serem aceitos ou '
                            'expirarem.',
                      ),
                    );
                  }
                  final pending = invitations
                      .where(
                        (i) => i.effectiveStatus == InvitationStatus.pending,
                      )
                      .length;
                  return RefreshIndicator(
                    onRefresh: () async =>
                        ref.invalidate(invitationsListProvider),
                    child: ListView.builder(
                      padding: const EdgeInsets.only(bottom: 24),
                      physics: const AlwaysScrollableScrollPhysics(),
                      itemCount: invitations.length + 1,
                      itemBuilder: (context, index) {
                        if (index == 0) {
                          return _CountHeader(
                            total: invitations.length,
                            pending: pending,
                          );
                        }
                        return _InvitationRow(
                          invitation: invitations[index - 1],
                        );
                      },
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
    final status = invitation.effectiveStatus;
    final canAct = status == InvitationStatus.pending;

    return Material(
      color: Colors.white,
      child: InkWell(
        onTap: () =>
            InvitationDetailRoute(invitationId: invitation.id).push(context),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: AppColors.surfaceSecondary),
            ),
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
                        color: AppColors.gray900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      invitation.email,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.gray500,
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
                            invitation.roleLabel,
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.navyDeep,
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
                            color: status.color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            status.label,
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: status.color,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      // "Expira em" only makes sense while it still can. On an
                      // accepted or revoked invite it was a future-tense line
                      // about a date that no longer means anything.
                      '${canAct ? 'Expira em ${formatDate(invitation.expiresAt)}' : 'Enviado em ${formatDate(invitation.createdAt)}'}'
                      ' · convidado por ${invitation.invitedByName}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.gray400,
                      ),
                    ),
                  ],
                ),
              ),
              if (canAct)
                PopupMenuButton<String>(
                  icon: const Icon(
                    Icons.more_vert_rounded,
                    color: AppColors.gray500,
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
                  color: AppColors.gray400,
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
    if (action == 'revoke') {
      final confirmed = await confirmRevokeInvitation(
        context,
        inviteeName: invitation.displayName,
      );
      if (!confirmed || !context.mounted) return;
    }

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
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeInviteActionError(error))),
        );
      }
    }
  }
}

/// How many invites there are, and how many still need an answer.
class _CountHeader extends StatelessWidget {
  const _CountHeader({required this.total, required this.pending});

  final int total;
  final int pending;

  @override
  Widget build(BuildContext context) {
    final totalLabel = total == 1 ? '1 convite' : '$total convites';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
      child: Text(
        pending == 0
            ? totalLabel
            : '$totalLabel · $pending pendente'
                  '${pending == 1 ? '' : 's'}',
        style: const TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          color: AppColors.gray500,
        ),
      ),
    );
  }
}

/// Scrollable wrapper so a full-screen message can still be pulled down.
class _RefreshableBody extends StatelessWidget {
  const _RefreshableBody({required this.onRefresh, required this.child});

  final VoidCallback onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: LayoutBuilder(
        builder: (context, constraints) => ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [SizedBox(height: constraints.maxHeight, child: child)],
        ),
      ),
    );
  }
}

class _InvitationsMessage extends StatelessWidget {
  const _InvitationsMessage({
    required this.icon,
    required this.title,
    required this.description,
    this.onRetry,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: AppColors.gray300),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              description,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12.5, color: AppColors.gray500),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              OutlinedButton(
                key: const Key('invitations-retry'),
                onPressed: onRetry,
                child: const Text('Tentar de novo'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
