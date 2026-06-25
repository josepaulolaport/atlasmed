import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/providers/auth_provider.dart';

// ======================================================================
// AppShellScreen — Scaffold wrapper with shared navigation drawer.
//   Used via ShellRoute in GoRouter to wrap authenticated screens.
//
//   Child screens access the drawer via:
//     AppShellScreenState.of(context)?.openDrawer()
//     openAppDrawer(context)  // convenience function
// ======================================================================

class AppShellScreen extends StatefulWidget {
  final Widget child;

  const AppShellScreen({super.key, required this.child});

  @override
  State<AppShellScreen> createState() => AppShellScreenState();
}

class AppShellScreenState extends State<AppShellScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  /// Finds the nearest ancestor AppShellScreenState from the given context.
  static AppShellScreenState? of(BuildContext context) =>
      context.findAncestorStateOfType<AppShellScreenState>();

  /// Opens the shared navigation drawer.
  void openDrawer() => _scaffoldKey.currentState?.openDrawer();

  /// Closes the shared navigation drawer.
  void closeDrawer() => _scaffoldKey.currentState?.closeDrawer();

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final activeSection = _sectionFromRoute(location);

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFf7f8fb),
      drawer: AtlasDrawer(activeSection: activeSection),
      body: widget.child,
    );
  }

  static String _sectionFromRoute(String location) {
    if (location.startsWith('/workspace')) return 'explorar';
    if (location.startsWith('/perfil')) return 'perfil';
    if (location.startsWith('/bi')) return 'desempenho';
    if (location.startsWith('/pedidos')) return 'pedidos';
    if (location.startsWith('/apresentacoes')) return 'apresentacoes';
    if (location.startsWith('/mapa')) return 'mapa';
    return '';
  }
}

/// Convenience call to open the AppShell drawer from any descendant context.
void openAppDrawer(BuildContext context) =>
    AppShellScreenState.of(context)?.openDrawer();

// ======================================================================
// AtlasTopBar — slim sticky bar with hamburger + breadcrumb
//   page    — current page label ("Explorar", "Perfil", etc.)
//   compact — drop breadcrumb for detail/sub screens
// ======================================================================

class AtlasTopBar extends StatelessWidget {
  final String page;
  final bool compact;

  const AtlasTopBar({super.key, this.page = '', this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xF2f7f8fb),
        border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
          child: SizedBox(
            height: 40,
            child: Row(
              children: [
                _hamburgerButton(context),
                if (!compact) ...[
                  const SizedBox(width: 8),
                  _breadcrumb(context),
                ],
                if (compact) const Spacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _hamburgerButton(BuildContext context) {
    return GestureDetector(
      onTap: () => openAppDrawer(context),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: const Color(0xFFeef0f3)),
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
            const Icon(Icons.menu_rounded,
                color: Color(0xFF0a2f7f), size: 15),
            // Green dot accent
            Positioned(
              top: 6,
              right: 5,
              child: Container(
                width: 5,
                height: 5,
                decoration: const BoxDecoration(
                  color: Color(0xFF16a373),
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
              color: Color(0xFF8a94a6),
            ),
          ),
          if (page.isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 6),
              child: CircleAvatar(
                radius: 1.5,
                backgroundColor: Color(0xFFc8cdd5),
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
                  color: Color(0xFF0f1729),
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

class _DrawerItem {
  final String key;
  final String label;
  final String route;
  final IconData icon;

  const _DrawerItem({
    required this.key,
    required this.label,
    required this.route,
    required this.icon,
  });
}

const _drawerItems = <_DrawerItem>[
  _DrawerItem(
    key: 'desempenho',
    label: 'Desempenho',
    route: '/bi',
    icon: Icons.bar_chart_rounded,
  ),
  _DrawerItem(
    key: 'explorar',
    label: 'Explorar',
    route: '/workspace',
    icon: Icons.search_rounded,
  ),
  _DrawerItem(
    key: 'mapa',
    label: 'Mapa',
    route: '/mapa',
    icon: Icons.map_outlined,
  ),
  _DrawerItem(
    key: 'pedidos',
    label: 'Pedidos',
    route: '/pedidos',
    icon: Icons.inventory_2_outlined,
  ),
  _DrawerItem(
    key: 'apresentacoes',
    label: 'Apresentações',
    route: '/apresentacoes',
    icon: Icons.slideshow_outlined,
  ),
  _DrawerItem(
    key: 'perfil',
    label: 'Perfil',
    route: '/perfil',
    icon: Icons.person_outline_rounded,
  ),
];

// ======================================================================
// AtlasDrawer — slide-in navigation drawer
// ======================================================================

class AtlasDrawer extends ConsumerWidget {
  final String activeSection;

  const AtlasDrawer({super.key, required this.activeSection});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final session = authState.session;
    final displayName = session?.userDisplayName ?? 'Rafael Melo';
    final email = _inferEmail(displayName);
    final initials = _initials(displayName);

    return SizedBox(
      width: MediaQuery.of(context).size.width * 0.78,
      child: Drawer(
        child: Column(
          children: [
            _DrawerHeader(
              initials: initials,
              displayName: displayName,
              email: email,
            ),
            Expanded(child: _NavItems(activeSection: activeSection)),
            _DrawerFooter(
              onLogout: () {
                Navigator.of(context).pop(); // close drawer
                ref.read(authProvider.notifier).logout();
                context.go('/splash');
              },
            ),
          ],
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return 'RM';
  }

  String _inferEmail(String displayName) {
    final slug = displayName.toLowerCase().replaceAll(RegExp(r'\s+'), '.');
    return '$slug@atlasmed.com';
  }
}

// ── Drawer subcomponents ───────────────────────────────────

class _DrawerHeader extends StatelessWidget {
  final String initials;
  final String displayName;
  final String email;

  const _DrawerHeader({
    required this.initials,
    required this.displayName,
    required this.email,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 52, 22, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0a2f7f), Color(0xFF1e40af)],
        ),
      ),
      child: Stack(
        children: [
          // Green radial glow
          Positioned(
            top: -40,
            right: -30,
            child: Container(
              width: 140,
              height: 140,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: Alignment.center,
                  radius: 0.7,
                  colors: [Color(0x5916a373), Colors.transparent],
                ),
              ),
            ),
          ),
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
                child: Center(
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
  final String activeSection;

  const _NavItems({required this.activeSection});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 12, 10, 0),
      child: Column(
        children: _drawerItems.map((item) {
          final isActive = item.key == activeSection;
          return _buildNavRow(item, isActive, context);
        }).toList(),
      ),
    );
  }

  Widget _buildNavRow(_DrawerItem item, bool isActive, BuildContext context) {
    final color =
        isActive ? const Color(0xFF0a2f7f) : const Color(0xFF374151);
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: isActive ? const Color(0xFFeef2ff) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            Navigator.of(context).pop(); // close drawer
            context.go(item.route);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 12,
            ),
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
                      color: Color(0xFF16a373),
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
        border: Border(top: BorderSide(color: Color(0xFFeef0f3))),
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
                        color: Color(0xFFb84545),
                      ),
                      SizedBox(width: 12),
                      Text(
                        'Sair',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFb84545),
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
            'Atlasmed · v2.4.1',
            style: TextStyle(
              fontSize: 10.5,
              color: Color(0xFF9ca3af),
              fontWeight: FontWeight.w500,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
