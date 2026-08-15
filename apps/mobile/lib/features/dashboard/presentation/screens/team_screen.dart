import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/providers/team_provider.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Above this many people, scanning stops working and you need to search.
const _searchThreshold = 8;

/// Equipe (spec 0014 §6) — the roster, and the way into a person's Desempenho.
///
/// A manager sees their reps; an admin sees managers and drills into a
/// manager's team.
///
/// Equipe answers *who*, Desempenho answers *how much* — so this screen keeps
/// what is true of a person (their clinics, their standing against the team)
/// and sends every deeper question to Desempenho rather than reproducing a
/// smaller version of it here.
///
/// Territory is deliberately absent. It is a property of the map, not of a
/// person you are comparing against their colleagues, and carrying it here made
/// the roster answer two questions at once. It lives on Territórios.
///
/// Every card therefore carries the same three figures at all times, and sorting
/// reorders the roster instead of changing what a card will tell you. It used to
/// do both: only the sorted metric had a value, so comparing two people on two
/// things meant sorting twice and remembering the first answer.
class TeamScreen extends ConsumerStatefulWidget {
  const TeamScreen({super.key, this.managerId, this.managerName});

  final int? managerId;
  final String? managerName;

  @override
  ConsumerState<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends ConsumerState<TeamScreen> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final verticalId = ref.watch(dashboardSelectedVerticalIdProvider);
    final role = ref.watch(currentUserRoleProvider);

    if (verticalId == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // Always by name. `sortBy` still exists on the API and still orders on the
    // batched metrics; nothing on this screen chooses another one any more.
    final args = TeamArgs(
      verticalId: verticalId,
      managerId: widget.managerId,
      sortBy: 'name',
      order: 'asc',
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: widget.managerId == null
          ? const AtlasAppBar(page: 'Equipe')
          : AppBar(title: Text(widget.managerName ?? 'Equipe')),
      body: RefreshIndicator(
        color: AppColors.navyBright,
        backgroundColor: Colors.white,
        strokeWidth: 2.6,
        onRefresh: () async => ref.invalidate(teamProvider(args)),
        child: RepositoryBuilder(
          repository: ref.watch(teamProvider(args)),
          builder: (context, roster, repo) {
            if (roster == null) {
              // A skeleton, not a spinner: the rest of the app's lists load
              // this way and `list_skeletons_test.dart` holds them to it.
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [TeamListSkeleton()],
              );
            }
            final members = roster.members;
            final invites = roster.pendingInvites;
            // Only the empty state asks this, and only an empty roster can
            // reach it — so there are never rows to read the kind from, and the
            // viewer is the only signal. Safe here for the reason it was not
            // when the header used it on every render: by the time an empty
            // response has arrived, the role has had the same trip to resolve.
            //
            // The distinction earns its keep: "nenhum gestor com zona" and
            // "nenhum representante nesta equipe" have different causes and
            // different fixes.
            final isManagerRoster =
                widget.managerId == null && role == UserRoleName.admin;
            if (members.isEmpty && invites.isEmpty) {
              // A ListView rather than a Center: an empty roster is exactly
              // when someone reaches for pull-to-refresh, and a non-scrollable
              // child never fires it.
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [_TeamEmptyState(isManagerRoster: isManagerRoster)],
              );
            }

            final visible = _filter(members);

            return ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              // Header, plus the empty-search notice when it applies.
              itemCount:
                  visible.length +
                  invites.length +
                  (visible.isEmpty && invites.isEmpty ? 2 : 1),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return _RosterHeader(
                    showSearch: members.length >= _searchThreshold,
                    search: _search,
                    onSearch: (value) => setState(() => _search = value),
                  );
                }
                if (visible.isEmpty && invites.isEmpty) {
                  return _NoSearchMatch(term: _search);
                }
                // Spec 0015 R11: people who already occupy territory but have
                // not arrived, listed last because they hold nothing yet.
                final position = index - 1;
                if (position >= visible.length) {
                  return _PendingInviteTile(
                    invite: invites[position - visible.length],
                  );
                }
                return _MemberTile(
                  member: visible[position],
                  viaManagerId: widget.managerId,
                );
              },
            );
          },
        ),
      ),
    );
  }

  /// Filtering happens here rather than on the server: the roster is already
  /// loaded in full, and a request per keystroke would make finding someone
  /// slower than scrolling to them.
  List<TeamMember> _filter(List<TeamMember> members) {
    final term = _search.trim().toLowerCase();
    if (term.isEmpty) return members;
    return members
        .where(
          (member) => '${member.displayName} ${member.email}'
              .toLowerCase()
              .contains(term),
        )
        .toList(growable: false);
  }
}

/// What sits above the roster: the search, when there are enough people to
/// need one.
///
/// It opened with the team totalled in one line and a sort control beside it.
/// Both answered a Desempenho question on an Equipe screen — the totals for the
/// team, the sort for ranking colleagues against each other. Equipe answers
/// *who*, and a roster of three to nine people in alphabetical order needs no
/// help being read.
class _RosterHeader extends StatelessWidget {
  const _RosterHeader({
    required this.showSearch,
    required this.search,
    required this.onSearch,
  });

  final bool showSearch;
  final String search;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    if (!showSearch) return const SizedBox(height: 8);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      child: _SearchField(value: search, onChanged: onSearch),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: TextField(
        onChanged: onChanged,
        style: const TextStyle(fontSize: 13.5),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Buscar pessoa',
          hintStyle: const TextStyle(fontSize: 13, color: AppColors.gray500),
          prefixIcon: const Icon(
            Icons.search_rounded,
            size: 17,
            color: AppColors.gray500,
          ),
          prefixIconConstraints: const BoxConstraints(minWidth: 34),
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(vertical: 9),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.surfaceSecondary),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.surfaceSecondary),
          ),
        ),
      ),
    );
  }
}

/// A search that matched nobody, said plainly.
class _NoSearchMatch extends StatelessWidget {
  const _NoSearchMatch({required this.term});

  final String term;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
      child: Text(
        'Ninguém nesta equipe corresponde a "$term".',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 13.5, color: AppColors.gray500),
      ),
    );
  }
}

class _MemberTile extends StatelessWidget {
  const _MemberTile({required this.member, required this.viaManagerId});

  final TeamMember member;

  /// Spec 0015 R2: on a drill-down the cards belong to that manager, and the
  /// profile carries the context so its Desempenho reads the same population.
  final int? viaManagerId;

  /// A card per person: who they are, and the way to them.
  ///
  /// It carried three figures and a bar scaled to the roster leader. Those are
  /// comparisons, and comparing people is what Desempenho is for — here they
  /// turned a list of colleagues into a scoreboard you had to read rather than
  /// scan. The sort still orders by them; the card no longer argues about them.
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          // One destination per card, always the same one: this person's
          // profile.
          onTap: () => TeamMemberProfileRoute(
            userId: member.userId,
            memberName: member.displayName,
            viaManagerId: viaManagerId,
          ).push(context),
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.surfaceSecondary),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.blue100, AppColors.blueLight],
                    ),
                    image: member.avatarUrl == null
                        ? null
                        : DecorationImage(
                            image: NetworkImage(member.avatarUrl!),
                            fit: BoxFit.cover,
                          ),
                  ),
                  alignment: Alignment.center,
                  child: member.avatarUrl != null
                      ? null
                      : Text(
                          member.displayName.characters.first.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.navyBright,
                          ),
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    member.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.gray500,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One icon-led fact under a person's name — the shape Explorar's rows use.
class _MemberMeta extends StatelessWidget {
  const _MemberMeta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.gray500),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
              color: AppColors.gray500,
            ),
          ),
        ),
      ],
    );
  }
}

/// Reps with no active patch (spec 0009 R8 / 0014 §6).
class RepsWithoutPatchScreen extends ConsumerWidget {
  const RepsWithoutPatchScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Representantes sem território')),
      body: RefreshIndicator(
        color: AppColors.navyBright,
        backgroundColor: Colors.white,
        strokeWidth: 2.6,
        onRefresh: () async => ref.invalidate(repsWithoutPatchProvider),
        child: RepositoryBuilder(
          repository: ref.watch(repsWithoutPatchProvider),
          builder: (context, members, repo) {
            if (members == null) {
              return const Center(child: CircularProgressIndicator());
            }
            if (members.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 32, vertical: 64),
                    child: Text(
                      'Todo representante tem um território.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: Color(0xFF6b7280)),
                    ),
                  ),
                ],
              );
            }
            return ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: members.length,
              itemBuilder: (context, index) {
                final member = members[index];
                return _PersonRow(
                  title: member.displayName,
                  subtitle: member.email,
                  subtitleIcon: Icons.mail_outline_rounded,
                  onTap: () => UserDetailRoute(id: member.userId).push(context),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// A person row in the Explorar shape, for the lists that carry no metrics.
class _PersonRow extends StatelessWidget {
  const _PersonRow({
    required this.title,
    required this.subtitle,
    required this.subtitleIcon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData subtitleIcon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.blue100, AppColors.blueLight],
                ),
              ),
              child: Text(
                title.characters.first.toUpperCase(),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyBright,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  const SizedBox(height: 3),
                  _MemberMeta(icon: subtitleIcon, text: subtitle),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: AppColors.gray500,
            ),
          ],
        ),
      ),
    );
  }
}

/// An empty roster, explained.
///
/// "Nenhuma pessoa nesta equipe" is true and useless. The two ways to get here
/// have different causes and different fixes, and saying which one you are
/// looking at is the difference between a dead end and a next step.
class _TeamEmptyState extends StatelessWidget {
  const _TeamEmptyState({required this.isManagerRoster});

  final bool isManagerRoster;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 56),
      child: Column(
        children: [
          Icon(
            isManagerRoster ? Icons.groups_outlined : Icons.person_off_outlined,
            size: 28,
            color: AppColors.gray500,
          ),
          const SizedBox(height: 12),
          Text(
            isManagerRoster
                ? 'Nenhum gestor com zona nesta linha'
                : 'Nenhum representante nesta equipe',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isManagerRoster
                ? 'A equipe aparece quando um gestor assume uma zona desta linha.'
                : 'Os representantes aparecem quando um patch é criado dentro das zonas do gestor.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.gray500,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

/// Someone invited who has not arrived yet (spec 0015 R11).
///
/// Greyed and inert: there is no profile to open, no metrics to show and
/// nothing to sort them by. The card exists so that a manager who invited
/// somebody can see them on the roster — which it, built on `users`, could not
/// do until they accepted.
class _PendingInviteTile extends StatelessWidget {
  const _PendingInviteTile({required this.invite});

  final PendingInvite invite;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: 0.72,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: AppColors.surfaceSecondary,
              ),
              child: const Icon(
                Icons.hourglass_empty_rounded,
                size: 20,
                color: AppColors.gray500,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    invite.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  const SizedBox(height: 3),
                  const _MemberMeta(
                    icon: Icons.mail_outline_rounded,
                    text: 'Convite pendente',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
