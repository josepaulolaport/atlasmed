import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
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

class AppShellScreenState extends State<AppShellScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

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
          onSelectBranch: (branchIndex) => navigationShell.goBranch(
            branchIndex,
            initialLocation: branchIndex == navigationShell.currentIndex,
          ),
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

// ======================================================================
// AtlasTopBar — legacy inline bar with hamburger + breadcrumb
//   page    — current page label ("Explorar", "Perfil", etc.)
//   compact — drop breadcrumb for detail/sub screens
// ======================================================================

class AtlasAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String page;
  final bool compact;

  const AtlasAppBar({super.key, this.page = '', this.compact = false});

  @override
  Size get preferredSize => const Size.fromHeight(48);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      automaticallyImplyLeading: false,
      backgroundColor: const AppColors.background,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      toolbarHeight: preferredSize.height,
      shape: const Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
      titleSpacing: 0,
      title: _AtlasTopBarContent(page: page, compact: compact),
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
            _hamburgerButton(context),
            if (!compact) ...[const SizedBox(width: 8), _breadcrumb(context)],
            if (compact) const Spacer(),
          ],
        ),
      ),
    );
  }

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
          border: Border.all(color: const AppColors.surfaceSecondary),
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
            const Icon(Icons.menu_rounded, color: AppColors.navyDeep, size: 15),
            // Green dot accent
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
    label: 'Explorar',
    route: '/explore',
    icon: Icons.search_rounded,
  ),
  AppNavigationItem(
    branchIndex: 1,
    label: 'Mapa',
    route: '/map',
    icon: Icons.map_outlined,
  ),
  AppNavigationItem(
    branchIndex: 2,
    label: 'Territórios',
    route: '/territories',
    icon: Icons.layers_outlined,
    visibleFor: canReadTerritories,
  ),
  AppNavigationItem(
    branchIndex: 3,
    label: 'Usuários',
    route: '/users',
    icon: Icons.people_outline_rounded,
    visibleFor: canManageUsers,
  ),
  AppNavigationItem(
    branchIndex: 4,
    label: 'Pedidos',
    route: '/orders',
    icon: Icons.inventory_2_outlined,
  ),
  AppNavigationItem(
    branchIndex: 5,
    label: 'Cadastros',
    route: '/registrations',
    icon: Icons.fact_check_outlined,
    visibleFor: canReviewCadastro,
  ),
  AppNavigationItem(
    branchIndex: 6,
    label: 'Não Conformidades',
    route: '/non-conformities',
    icon: Icons.rate_review_outlined,
    visibleFor: canReadFieldSuggestions,
  ),
  AppNavigationItem(
    branchIndex: 7,
    label: 'Produtos',
    route: '/products',
    icon: Icons.inventory_outlined,
    visibleFor: canReadCatalog,
  ),
  AppNavigationItem(
    branchIndex: 8,
    label: 'Perfil',
    route: '/profile',
    icon: Icons.person_outline_rounded,
  ),
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
                      avatarToken: session.token,
                    ),
                    Expanded(
                      child: _NavItems(
                        activeBranchIndex: activeBranchIndex,
                        onSelectBranch: onSelectBranch,
                        role: user?.role.name,
                      ),
                    ),
                    _DrawerFooter(
                      onLogout: () {
                        Navigator.of(context).pop();
                        repository.delete();
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

class _DrawerHeader extends StatelessWidget {
  final String initials;
  final String displayName;
  final String email;
  final String? avatarUrl;
  final String? avatarToken;

  const _DrawerHeader({
    required this.initials,
    required this.displayName,
    required this.email,
    this.avatarUrl,
    this.avatarToken,
  });

  String _avatarUri(String url) {
    return url.startsWith("http") ? url : "${AppConfig.apiBaseUrl}$url";
  }

  @override
  Widget build(BuildContext context) {
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
                        errorWidget: (_, _, _) => Center(
                          child: Text(
                            initials,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      )
                    : Center(
                        child: Text(
                          initials,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                            color: Colors.white,
                          ),
                        ),
                      ),
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

class _NavItems extends StatelessWidget {
  final int activeBranchIndex;
  final ValueChanged<int> onSelectBranch;
  final UserRoleName? role;

  const _NavItems({
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

    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 12, 10, 0),
      child: Column(
        children: items.map((item) {
          final isActive = item.isActiveForBranch(activeBranchIndex);
          return _buildNavRow(item, isActive, context);
        }).toList(),
      ),
    );
  }

  Widget _buildNavRow(
    AppNavigationItem item,
    bool isActive,
    BuildContext context,
  ) {
    final color = isActive ? const AppColors.navyDeep : const AppColors.gray700;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: isActive ? const AppColors.blue50 : Colors.transparent,
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

class _DrawerFooter extends StatelessWidget {
  final VoidCallback onLogout;

  const _DrawerFooter({required this.onLogout});

  @override
  Widget build(BuildContext context) {
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
          const Text(
            'Atlasmed · v0.1.0',
            style: TextStyle(
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
