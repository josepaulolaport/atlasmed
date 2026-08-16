import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_blurhash/flutter_blurhash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/config/app_version_provider.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/session/models/session.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/role_capabilities.dart';
import 'package:atlasmed_mobile_app/core/user/repositories/user_repository.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

// ======================================================================
// AppShellScreen — Scaffold wrapper with shared navigation drawer.
//   Used via ShellRoute in GoRouter to wrap authenticated screens.
//
//   Child screens access the drawer via:
//     AppShellScreenState.of(context)?.openDrawer()
//     openAppDrawer(context)  // convenience function
// ======================================================================

class AppShellScreen extends StatefulWidget {
  final StatefulNavigationShell navigationShell;

  const AppShellScreen({super.key, required this.navigationShell});

  @override
  State<AppShellScreen> createState() => AppShellScreenState();
}

/// The branches visited before the current one, most recent last.
///
/// `StatefulNavigationShell` gives each branch its own stack and no order
/// between them, so at the root of a branch there is nothing to go back to: you
/// land on Equipe from Desempenho and the only way out is the drawer again.
/// This is that memory, and it is the whole of it — enough to answer "where was
/// I", not a second navigator.
class BranchHistory {
  /// Bounded because this is a convenience, not a record. Somebody moving
  /// between two sections all afternoon should not accumulate an afternoon of
  /// history to walk back through.
  static const maxEntries = 12;

  final List<int> _entries = [];

  bool get canGoBack => _entries.isNotEmpty;

  /// Records leaving [current]. Re-selecting the open branch is not a move, so
  /// it remembers nothing — otherwise tapping Equipe twice would make "back"
  /// return to Equipe.
  void push({required int leaving, required int entering}) {
    if (leaving == entering) return;
    _entries.add(leaving);
    if (_entries.length > maxEntries) _entries.removeAt(0);
  }

  /// The branch to return to, or null when there is none.
  int? pop() => _entries.isEmpty ? null : _entries.removeLast();
}

class AppShellScreenState extends State<AppShellScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  final BranchHistory _branchHistory = BranchHistory();

  bool get canGoBackBranch => _branchHistory.canGoBack;

  /// Switches branch, remembering the one being left.
  void selectBranch(int branchIndex) {
    final current = widget.navigationShell.currentIndex;
    _branchHistory.push(leaving: current, entering: branchIndex);
    widget.navigationShell.goBranch(
      branchIndex,
      initialLocation: branchIndex == current,
    );
    setState(() {});
  }

  /// Returns to the branch this one was opened from.
  void goBackBranch() {
    final previous = _branchHistory.pop();
    if (previous == null) return;
    widget.navigationShell.goBranch(previous);
    setState(() {});
  }

  static const Color _defaultShellChromeColor = AppColors.background;

  /// Finds the nearest ancestor AppShellScreenState from the given context.
  static AppShellScreenState? of(BuildContext context) =>
      context.findAncestorStateOfType<AppShellScreenState>();

  /// Opens the shared navigation drawer.
  void openDrawer() => _scaffoldKey.currentState?.openDrawer();

  /// Closes the shared navigation drawer.
  void closeDrawer() => _scaffoldKey.currentState?.closeDrawer();

  @override
  Widget build(BuildContext context) {
    final navigationShell = widget.navigationShell;
    final statusBarHeight = MediaQuery.paddingOf(context).top;
    final chromeColor = _defaultShellChromeColor;
    final overlayStyle = SystemUiOverlayStyle(
      statusBarColor: chromeColor,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.dark,
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: overlayStyle,
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: _defaultShellChromeColor,
        drawer: AtlasDrawer(
          activeBranchIndex: navigationShell.currentIndex,
          onSelectBranch: selectBranch,
        ),
        body: Stack(
          children: [
            navigationShell,
            if (statusBarHeight > 0)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: statusBarHeight,
                child: IgnorePointer(child: ColoredBox(color: chromeColor)),
              ),
          ],
        ),
      ),
    );
  }
}

/// Convenience call to open the AppShell drawer from any descendant context.
void openAppDrawer(BuildContext context) =>
    AppShellScreenState.of(context)?.openDrawer();

/// Signing out drops the session **and** the cached user.
///
/// The session was never the only thing identifying a person. `UserRepository`
/// is a long-lived singleton and `currentValueOrResolve()` returns its cached
/// value without refetching — it says so in its own doc comment — so a logout
/// that clears only the session leaves the previous user's name, e-mail and
/// role in place. The next person to sign in then inherits them: the drawer
/// greets them by someone else's name, and `currentUserRoleProvider` reports
/// someone else's role to every screen that gates on it, until the app is
/// restarted.
///
/// Revoking remotely is best effort. An expired token or a dead network must
/// not leave the app signed in locally, so the user is cleared in a `finally` —
/// but the failure is logged rather than swallowed, because a revoke that
/// quietly failed leaves a live session on the server.
Future<void> performLogout({
  required Future<void> Function() revokeSession,
  required Future<void> Function() clearUser,
}) async {
  try {
    await revokeSession();
  } catch (error) {
    BaseRepository.logger(
      'Logout: failed to revoke the remote session: $error',
    );
  } finally {
    await clearUser();
  }
}

// ======================================================================
// AtlasTopBar — legacy inline bar with hamburger + breadcrumb
//   page    — current page label ("Explorar", "Perfil", etc.)
//   compact — drop breadcrumb for detail/sub screens
// ======================================================================

class AtlasAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String page;
  final bool compact;
  final List<Widget>? actions;

  const AtlasAppBar({
    super.key,
    this.page = '',
    this.compact = false,
    this.actions,
  });

  @override
  Size get preferredSize => const Size.fromHeight(48);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      automaticallyImplyLeading: false,
      backgroundColor: AppColors.background,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      toolbarHeight: preferredSize.height,
      shape: const Border(
        bottom: BorderSide(color: AppColors.surfaceSecondary),
      ),
      titleSpacing: 0,
      title: _AtlasTopBarContent(page: page, compact: compact),
      actions: actions,
      systemOverlayStyle: .dark,
    );
  }
}

class AtlasTopBar extends StatelessWidget {
  final String page;
  final bool compact;

  const AtlasTopBar({super.key, this.page = '', this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.background,
        border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
      ),
      child: SafeArea(
        bottom: false,
        child: _AtlasTopBarContent(page: page, compact: compact),
      ),
    );
  }
}

class _AtlasTopBarContent extends StatelessWidget {
  final String page;
  final bool compact;

  const _AtlasTopBarContent({required this.page, required this.compact});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
      child: SizedBox(
        height: 40,
        child: Row(
          children: [
            // Shown only once there is somewhere to return to. At the root of a
            // branch the leading control is a menu, which opens a list of
            // destinations rather than retracing the one step you took — so
            // arriving on Equipe from Desempenho left no way back but choosing
            // Desempenho again from that list.
            if (_branchBackAvailable(context)) ...[
              _branchBackButton(context),
              const SizedBox(width: 8),
            ],
            _hamburgerButton(context),
            if (!compact) ...[const SizedBox(width: 8), _breadcrumb(context)],
            if (compact) const Spacer(),
          ],
        ),
      ),
    );
  }

  static bool _branchBackAvailable(BuildContext context) =>
      AppShellScreenState.of(context)?.canGoBackBranch ?? false;

  /// Back to the section you came from, drawn like the leading control so the
  /// pair reads as one bar rather than as a button bolted onto one.
  Widget _branchBackButton(BuildContext context) {
    return GestureDetector(
      onTap: () => AppShellScreenState.of(context)?.goBackBranch(),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: AppColors.surfaceSecondary),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A0f1729),
              blurRadius: 2,
              offset: Offset(0, 1),
            ),
            BoxShadow(
              color: Color(0x0D0f1729),
              blurRadius: 14,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: const Icon(
          Icons.arrow_back_ios_new_rounded,
          color: AppColors.navyDeep,
          size: 15,
        ),
      ),
    );
  }

  /// The leading button, which is a *menu* inside the shell and a *back* button
  /// above it.
  ///
  /// It always did both — a screen pushed over the shell has no
  /// `AppShellScreenState` ancestor, so the tap fell through to `maybePop`. What
  /// it did not do was say so: it drew a hamburger either way, so on a rep's
  /// Desempenho, pushed from Equipe, the only way back looked like a menu and
  /// nobody tried it. The icon now matches the action.
  Widget _hamburgerButton(BuildContext context) {
    final isInsideAppShell = AppShellScreenState.of(context) != null;

    return GestureDetector(
      onTap: isInsideAppShell
          ? () => openAppDrawer(context)
          : () => Navigator.of(context).maybePop(),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: AppColors.surfaceSecondary),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A0f1729),
              blurRadius: 2,
              offset: Offset(0, 1),
            ),
            BoxShadow(
              color: Color(0x0D0f1729),
              blurRadius: 14,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Icon(
              isInsideAppShell
                  ? Icons.menu_rounded
                  : Icons.arrow_back_ios_new_rounded,
              color: AppColors.navyDeep,
              size: 15,
            ),
            // Green dot accent — the drawer's "you have somewhere to go" mark.
            // A back button has one obvious destination, so it carries none.
            if (isInsideAppShell)
              Positioned(
                top: 6,
                right: 5,
                child: Container(
                  width: 5,
                  height: 5,
                  decoration: const BoxDecoration(
                    color: AppColors.green,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.white,
                        blurRadius: 0,
                        spreadRadius: 1.5,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _breadcrumb(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          Text(
            'ATLASMED',
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.4,
              color: AppColors.gray400,
            ),
          ),
          if (page.isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6),
              child: CircleAvatar(
                radius: 1.5,
                backgroundColor: AppColors.gray300,
              ),
            ),
            Flexible(
              child: Text(
                page,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.1,
                  color: AppColors.gray900,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ======================================================================
// Navigation items definition
// ======================================================================

class AppNavigationItem {
  final int branchIndex;
  final String label;
  final String route;
  final IconData? icon;

  /// When set, the item is hidden from roles for which this returns `false`.
  final bool Function(UserRoleName role)? visibleFor;

  const AppNavigationItem({
    required this.branchIndex,
    required this.label,
    required this.route,
    this.icon,
    this.visibleFor,
  });

  bool isActiveForBranch(int activeBranchIndex) =>
      branchIndex == activeBranchIndex;
}

const appNavigationItems = <AppNavigationItem>[
  AppNavigationItem(
    branchIndex: 0,
    label: 'Desempenho',
    route: '/dashboard',
    icon: Icons.bar_chart_rounded,
  ),
  AppNavigationItem(
    branchIndex: 1,
    label: 'Explorar',
    route: '/explore',
    icon: Icons.search_rounded,
  ),
  AppNavigationItem(
    branchIndex: 2,
    label: 'Mapa',
    route: '/map',
    icon: Icons.map_outlined,
  ),
  AppNavigationItem(
    branchIndex: 3,
    label: 'Agenda',
    route: '/agenda',
    icon: Icons.calendar_month_outlined,
    visibleFor: canReadAgenda,
  ),
  // Territórios and Usuários are out of the drawer by request. Branches 4 and
  // 5 and their routes still exist, so anything already holding a link still
  // resolves — only the way in from here is gone.
  //
  // What goes with them, so it is not rediscovered as a bug: the territory
  // editor and the map of zones have no other entry point, and neither does
  // the invitations list. "Convidar" starts on Usuários and nowhere else, so
  // with this removed the app cannot invite anyone.
  AppNavigationItem(
    branchIndex: 11,
    label: 'Equipe',
    route: '/team',
    icon: Icons.groups_outlined,
    visibleFor: canReadTeam,
  ),
  AppNavigationItem(
    branchIndex: 6,
    label: 'Pedidos',
    route: '/orders',
    icon: Icons.inventory_2_outlined,
  ),
  AppNavigationItem(
    branchIndex: 7,
    label: 'Cadastros',
    route: '/registrations',
    icon: Icons.fact_check_outlined,
    visibleFor: canReviewCadastro,
  ),
  AppNavigationItem(
    branchIndex: 8,
    label: 'Não Conformidades',
    route: '/non-conformities',
    icon: Icons.rate_review_outlined,
    visibleFor: canReadFieldSuggestions,
  ),
  AppNavigationItem(
    branchIndex: 9,
    label: 'Produtos',
    route: '/products',
    icon: Icons.inventory_outlined,
    visibleFor: canReadCatalog,
  ),

  // Perfil is hidden alongside Usuários. Branch 10 and `/profile` still exist —
  // only the drawer entry is gone. Note what goes with it: the avatar picker,
  // the push-notification preference and the personal Território card have no
  // other entry point in the app. Signing out does not: "Sair" is in the
  // drawer's own footer, not on Perfil.
];

class AtlasDrawer extends ConsumerWidget {
  final int activeBranchIndex;
  final ValueChanged<int> onSelectBranch;

  const AtlasDrawer({
    super.key,
    required this.activeBranchIndex,
    required this.onSelectBranch,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionEnvironment = ref.watch(sessionProvider);

    return RepositoryBuilder<SessionEnvironment, Session?>(
      repository: sessionEnvironment,
      builder: (context, session, repository) {
        if (session == null) {
          return const SizedBox.shrink();
        }

        return RepositoryBuilder<UserRepository, User>(
          repository: ref.watch(userProvider),
          builder: (context, user, _) {
            final displayName = user?.displayName ?? 'Usuário';
            final email = user?.email ?? '';
            final initials = _initials(displayName);

            return SizedBox(
              width: MediaQuery.of(context).size.width * 0.78,
              child: Drawer(
                shape: const RoundedRectangleBorder(),
                child: Column(
                  children: [
                    _DrawerHeader(
                      initials: initials,
                      displayName: displayName,
                      email: email,
                      avatarUrl: user?.avatarUrl,
                      avatarBlurhash: user?.avatarBlurhash,
                      avatarToken: session.token,
                    ),
                    Expanded(
                      child: AtlasDrawerNavigation(
                        activeBranchIndex: activeBranchIndex,
                        onSelectBranch: onSelectBranch,
                        role: user?.role.name,
                      ),
                    ),
                    _DrawerFooter(
                      onLogout: () {
                        Navigator.of(context).pop();
                        final userRepository = ref.read(userProvider);
                        performLogout(
                          revokeSession: repository.delete,
                          clearUser: userRepository.clear,
                        );
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return parts.first[0].toUpperCase();
  }
}

// ── Drawer subcomponents ───────────────────────────────────

class _InitialsAvatar extends StatelessWidget {
  const _InitialsAvatar({required this.initials});

  final String initials;

  @override
  Widget build(BuildContext context) => Center(
    child: Text(
      initials,
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
        color: Colors.white,
      ),
    ),
  );
}

class _DrawerHeader extends StatelessWidget {
  final String initials;
  final String displayName;
  final String email;
  final String? avatarUrl;
  final String? avatarBlurhash;
  final String? avatarToken;

  const _DrawerHeader({
    required this.initials,
    required this.displayName,
    required this.email,
    this.avatarUrl,
    this.avatarBlurhash,
    this.avatarToken,
  });

  String _avatarUri(String url) {
    return url.startsWith("http") ? url : "${AppConfig.apiBaseUrl}$url";
  }

  @override
  Widget build(BuildContext context) {
    final hash = avatarBlurhash?.trim();
    final hasBlurhash = hash != null && hash.isNotEmpty;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 52, 22, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.navyDeep, AppColors.navyBright],
        ),
      ),
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar initials circle
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.25),
                  ),
                  shape: BoxShape.circle,
                ),
                clipBehavior: Clip.antiAlias,
                child: avatarUrl != null && avatarUrl!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: _avatarUri(avatarUrl!),
                        httpHeaders: avatarToken == null
                            ? null
                            : {"Authorization": "Bearer $avatarToken"},
                        fit: BoxFit.cover,
                        placeholder: (_, _) => hasBlurhash
                            ? BlurHash(hash: hash)
                            : _InitialsAvatar(initials: initials),
                        errorWidget: (_, _, _) =>
                            _InitialsAvatar(initials: initials),
                      )
                    : _InitialsAvatar(initials: initials),
              ),
              const SizedBox(height: 12),
              Text(
                displayName,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                email,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.7),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class AtlasDrawerNavigation extends StatelessWidget {
  final int activeBranchIndex;
  final ValueChanged<int> onSelectBranch;
  final UserRoleName? role;

  const AtlasDrawerNavigation({
    super.key,
    required this.activeBranchIndex,
    required this.onSelectBranch,
    this.role,
  });

  @override
  Widget build(BuildContext context) {
    final items = appNavigationItems.where((item) {
      final visibleFor = item.visibleFor;
      if (visibleFor == null) return true;
      // Hide role-gated items while the role is still resolving, so they
      // never flash on before access is confirmed.
      return role != null && visibleFor(role!);
    });

    return ListView(
      key: const Key('atlas-drawer-navigation'),
      padding: const EdgeInsets.fromLTRB(10, 12, 10, 8),
      children: items.map((item) {
        final isActive = item.isActiveForBranch(activeBranchIndex);
        return _buildNavRow(item, isActive, context);
      }).toList(),
    );
  }

  Widget _buildNavRow(
    AppNavigationItem item,
    bool isActive,
    BuildContext context,
  ) {
    final color = isActive ? AppColors.navyDeep : AppColors.gray700;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: isActive ? AppColors.blue50 : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            Navigator.of(context).pop(); // close drawer
            onSelectBranch(item.branchIndex);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Icon(item.icon, size: 22, color: color),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                      color: color,
                      letterSpacing: -0.1,
                    ),
                  ),
                ),
                if (isActive)
                  const Text(
                    '•',
                    style: TextStyle(
                      color: AppColors.green,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DrawerFooter extends ConsumerWidget {
  final VoidCallback onLogout;

  const _DrawerFooter({required this.onLogout});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final version = ref.watch(appVersionProvider).valueOrNull ?? '';
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 22),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.surfaceSecondary)),
      ),
      child: Column(
        children: [
          SizedBox(
            width: double.infinity,
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: onLogout,
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                  child: Row(
                    children: [
                      Icon(
                        Icons.logout_rounded,
                        size: 18,
                        color: AppColors.red,
                      ),
                      SizedBox(width: 12),
                      Text(
                        'Sair',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.red,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Atlasmed · $version',
            style: const TextStyle(
              fontSize: 10.5,
              color: AppColors.gray400,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
