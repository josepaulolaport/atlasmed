import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/models.dart';
import '../providers/profile_provider.dart';

// ======================================================================
// ProfileScreen — representative's personal overview
// ======================================================================

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _logoutConfirm = false;

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileProvider);
    final territoryAsync = ref.watch(territoryStatsProvider);
    final summaryAsync = ref.watch(quickSummaryProvider);
    final prefsAsync = ref.watch(preferencesProvider);
    final activityAsync = ref.watch(recentActivityProvider);
    final supportAsync = ref.watch(supportItemsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: Stack(
        children: [
          SafeArea(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Top bar ──────────────────────────────────
                  _buildTopBar(),

                  // ── Header · identity ────────────────────────
                  profileAsync.when(
                    loading: () => _buildHeaderShimmer(),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (profile) => _buildHeader(profile),
                  ),

                  // ── Body ─────────────────────────────────────
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Território
                        territoryAsync.when(
                          loading: () => _buildSectionShimmer(height: 260),
                          error: (_, __) => const SizedBox.shrink(),
                          data: (stats) => _buildTerritory(stats),
                        ),
                        const SizedBox(height: 20),

                        // Resumo rápido
                        summaryAsync.when(
                          loading: () => _buildSummaryShimmer(),
                          error: (_, __) => const SizedBox.shrink(),
                          data: (items) => _buildQuickSummary(items),
                        ),
                        const SizedBox(height: 20),

                        // Preferências
                        prefsAsync.when(
                          loading: () => _buildSectionShimmer(height: 250),
                          error: (_, __) => const SizedBox.shrink(),
                          data: (items) => _buildPreferences(items),
                        ),
                        const SizedBox(height: 20),

                        // Atividade recente
                        activityAsync.when(
                          loading: () => _buildSectionShimmer(height: 200),
                          error: (_, __) => const SizedBox.shrink(),
                          data: (items) => _buildRecentActivity(items),
                        ),
                        const SizedBox(height: 20),

                        // Suporte & conta
                        supportAsync.when(
                          loading: () => _buildSectionShimmer(height: 160),
                          error: (_, __) => const SizedBox.shrink(),
                          data: (items) => _buildSupportSection(items),
                        ),
                        const SizedBox(height: 12),

                        // Logout
                        _buildLogoutButton(),

                        // Footer
                        profileAsync.when(
                          data: (profile) => _buildFooter(profile.since),
                          loading: () => const SizedBox.shrink(),
                          error: (_, __) => const SizedBox.shrink(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Logout confirmation sheet ────────────────────────
          if (_logoutConfirm) _buildLogoutSheet(),
        ],
      ),
    );
  }

  // ── Top bar ─────────────────────────────────────────────────
  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _GlassButton(
            child: const Icon(Icons.menu_rounded, color: Color(0xFF0a2f7f), size: 18),
            onTap: () {},
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xFFeef0f3)),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6, height: 6,
                  decoration: const BoxDecoration(
                    color: Color(0xFF0a2f7f), shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                const Text('Perfil',
                  style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.3,
                    color: Color(0xFF0a2f7f),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 38), // balance menu on left
        ],
      ),
    );
  }

  // ── Header ──────────────────────────────────────────────────
  Widget _buildHeader(UserProfile profile) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0x120a2f7f),
            Color(0x050a2f7f),
            Colors.transparent,
          ],
        ),
      ),
      child: Column(
        children: [
          // Edit button
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              _GlassButton(
                child: const Icon(Icons.edit_outlined, color: Color(0xFF374151), size: 15),
                onTap: () {},
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Avatar + info
          Row(
            children: [
              _ProfileAvatar(initials: profile.initials, size: 66),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(profile.displayName,
                      style: const TextStyle(
                        fontSize: 19, fontWeight: FontWeight.w700,
                        letterSpacing: -0.4, color: Color(0xFF1f2937),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(profile.role,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
                    ),
                    const SizedBox(height: 8),
                    // Region chip
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0x140a2f7f),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.location_on_outlined, size: 10, color: const Color(0xFF0a2f7f)),
                          const SizedBox(width: 4),
                          Text(profile.region,
                            style: const TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.2,
                              color: Color(0xFF0a2f7f),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderShimmer() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter, end: Alignment.bottomCenter,
          colors: [Color(0x120a2f7f), Color(0x050a2f7f), Colors.transparent],
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 30),
          Row(
            children: [
              Container(width: 66, height: 66, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFeef0f3))),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(width: 150, height: 14, decoration: BoxDecoration(color: const Color(0xFFeef0f3), borderRadius: BorderRadius.circular(4))),
                  const SizedBox(height: 8),
                  Container(width: 100, height: 10, decoration: BoxDecoration(color: const Color(0xFFeef0f3), borderRadius: BorderRadius.circular(4))),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Território ──────────────────────────────────────────────
  Widget _buildTerritory(TerritoryStats stats) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Território', action: 'Abrir mapa'),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFeef0f3)),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: [
              // Map preview
              _TerritoryMapPreview(height: 150),
              // Stats row
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 12, 4, 4),
                child: Row(
                  children: [
                    _StatCell(value: '${stats.clinics}', label: 'clínicas'),
                    Container(width: 1, height: 28, color: const Color(0xFFf1f3f6)),
                    _StatCell(value: '${stats.doctors}', label: 'médicos'),
                    Container(width: 1, height: 28, color: const Color(0xFFf1f3f6)),
                    _StatCell(value: '${stats.coveragePct}%', label: 'cobertura', highlight: true),
                  ],
                ),
              ),
              // Coverage text + bar
              Padding(
                padding: const EdgeInsets.fromLTRB(6, 10, 6, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        RichText(
                          text: TextSpan(
                            style: const TextStyle(fontSize: 12, color: Color(0xFF374151)),
                            children: [
                              const TextSpan(text: 'Você cobriu '),
                              TextSpan(
                                text: '${stats.coveragePct}%',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700, color: Color(0xFF16a373),
                                ),
                              ),
                              const TextSpan(text: ' da sua região'),
                            ],
                          ),
                        ),
                        Text(stats.coverageWeek,
                          style: const TextStyle(fontSize: 10.5, color: Color(0xFF9ca3af)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      height: 5,
                      decoration: BoxDecoration(
                        color: const Color(0xFFeef0f3),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: FractionallySizedBox(
                        widthFactor: stats.coveragePct / 100,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF16a373), Color(0xFF14b680)],
                            ),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Resumo rápido ──────────────────────────────────────────
  Widget _buildQuickSummary(List<QuickSummaryItem> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Resumo rápido'),
        const SizedBox(height: 8),
        Row(
          children: items.map((item) => Expanded(
            child: Container(
              margin: EdgeInsets.only(right: items.last == item ? 0 : 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: const Color(0xFFeef0f3)),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.value,
                    style: TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w700,
                      color: Color(item.color), letterSpacing: -0.5, height: 1,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(item.label,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1f2937)),
                  ),
                  const SizedBox(height: 2),
                  Text(item.sub,
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF9ca3af)),
                  ),
                ],
              ),
            ),
          )).toList(),
        ),
      ],
    );
  }

  Widget _buildSummaryShimmer() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Resumo rápido'),
        const SizedBox(height: 8),
        Row(
          children: List.generate(3, (i) => Expanded(
            child: Container(
              margin: EdgeInsets.only(right: i < 2 ? 8 : 0),
              height: 88,
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: const Color(0xFFeef0f3)),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(width: 40, height: 14, decoration: BoxDecoration(color: const Color(0xFFeef0f3), borderRadius: BorderRadius.circular(4))),
                    const SizedBox(height: 20),
                    Container(width: 50, height: 8, decoration: BoxDecoration(color: const Color(0xFFeef0f3), borderRadius: BorderRadius.circular(4))),
                  ],
                ),
              ),
            ),
          )),
        ),
      ],
    );
  }

  // ── Preferências ────────────────────────────────────────────
  Widget _buildPreferences(List<PreferenceItem> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Preferências'),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFeef0f3)),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: List.generate(items.length, (i) {
              final item = items[i];
              return _PrefRow(
                icon: _prefIcon(item.label),
                label: item.label,
                sub: item.sub,
                trailing: item.kind == 'toggle'
                    ? _ProfileToggle(value: item.value, accent: const Color(0xFF0a2f7f))
                    : _ProfileChevron(),
                showTopBorder: i > 0,
              );
            }),
          ),
        ),
      ],
    );
  }

  Widget _prefIcon(String label) {
    return Container(
      width: 32, height: 32,
      decoration: BoxDecoration(
        color: const Color(0x120a2f7f),
        borderRadius: BorderRadius.circular(9),
      ),
      child: Center(
        child: Icon(_prefIconData(label), size: 14, color: const Color(0xFF0a2f7f)),
      ),
    );
  }

  IconData _prefIconData(String label) {
    return switch (label) {
      'Alertas de follow-up' => Icons.notifications_outlined,
      'Oportunidades próximas' => Icons.near_me_outlined,
      'Horário de trabalho' => Icons.schedule_outlined,
      'Download só em Wi-Fi' => Icons.wifi_outlined,
      'Idioma' => Icons.language_outlined,
      _ => Icons.settings_outlined,
    };
  }

  // ── Atividade recente ───────────────────────────────────────
  Widget _buildRecentActivity(List<RecentActivity> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Atividade recente', action: 'Ver tudo'),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFeef0f3)),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: items.map((a) => _ActivityRow(activity: a)).toList(),
          ),
        ),
      ],
    );
  }

  // ── Suporte & conta ─────────────────────────────────────────
  Widget _buildSupportSection(List<SupportItem> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Suporte & conta'),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFeef0f3)),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: items.map((item) => _SupportRow(item: item)).toList(),
          ),
        ),
      ],
    );
  }

  // ── Logout button ───────────────────────────────────────────
  Widget _buildLogoutButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () => setState(() => _logoutConfirm = true),
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14),
          side: const BorderSide(color: Color(0x38b84545)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          backgroundColor: Colors.white,
        ),
        icon: const Icon(Icons.logout_rounded, size: 15, color: Color(0xFFb84545)),
        label: const Text('Sair da conta',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFFb84545))),
      ),
    );
  }

  // ── Logout confirmation sheet ────────────────────────────────
  Widget _buildLogoutSheet() {
    return GestureDetector(
      onTap: () => setState(() => _logoutConfirm = false),
      child: Container(
        color: const Color(0x73241810),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            GestureDetector(
              onTap: () {},
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(20),
                    topRight: Radius.circular(20),
                  ),
                  boxShadow: [BoxShadow(color: Color(0x2E000000), blurRadius: 32, offset: Offset(0, -8))],
                ),
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Handle
                    Container(
                      width: 36, height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFFe5e7eb),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 18),
                    // Icon
                    Container(
                      width: 52, height: 52,
                      decoration: BoxDecoration(
                        color: const Color(0x1Ab84545),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(Icons.logout_rounded, size: 22, color: Color(0xFFb84545)),
                    ),
                    const SizedBox(height: 14),
                    const Text('Sair da conta?',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1f2937), letterSpacing: -0.3),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Você precisará fazer login novamente para\nacessar seus pedidos, visitas e rotas.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Color(0xFF6b7280), height: 1.5),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () {
                          ref.read(authProvider.notifier).logout();
                          context.go('/splash');
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFb84545),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Sair',
                          style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => setState(() => _logoutConfirm = false),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: const BorderSide(color: Color(0xFFeef0f3)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Cancelar',
                          style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w500, color: Color(0xFF374151))),
                      ),
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

  // ── Footer ──────────────────────────────────────────────────
  Widget _buildFooter(String since) {
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Center(
        child: Text('Atlasmed · v2.6.1 · $since',
          style: const TextStyle(fontSize: 10.5, color: Color(0xFFc4c9d2), letterSpacing: 0.3)),
      ),
    );
  }

  // ── Shimmer placeholder for sections ────────────────────────
  Widget _buildSectionShimmer({double height = 200}) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFeef0f3)),
        borderRadius: BorderRadius.circular(14),
      ),
    );
  }
}

// ======================================================================
// Shared components
// ======================================================================

class _GlassButton extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  const _GlassButton({required this.child, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Container(
          width: 34, height: 34,
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFeef0f3)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  final String initials;
  final double size;
  const _ProfileAvatar({required this.initials, this.size = 72});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0a2f7f), Color(0xFF1e40af), Color(0xFF16a373)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0a2f7f).withValues(alpha: 0.22),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
          const BoxShadow(
            color: Color(0xCCffffff),
            blurRadius: 0,
            spreadRadius: -2.5,
          ),
        ],
      ),
      child: Center(
        child: Text(initials,
          style: TextStyle(
            fontSize: size * 0.36, fontWeight: FontWeight.w700,
            letterSpacing: -0.5, color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class _ProfileToggle extends StatefulWidget {
  final bool value;
  final Color accent;
  const _ProfileToggle({required this.value, required this.accent});

  @override
  State<_ProfileToggle> createState() => _ProfileToggleState();
}

class _ProfileToggleState extends State<_ProfileToggle> {
  late bool _value;

  @override
  void initState() {
    super.initState();
    _value = widget.value;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => setState(() => _value = !_value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 38, height: 22,
        decoration: BoxDecoration(
          color: _value ? widget.accent : const Color(0xFFd9dde4),
          borderRadius: BorderRadius.circular(11),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          alignment: _value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 18, height: 18, margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [BoxShadow(color: Color(0x2E000000), blurRadius: 3)],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileChevron extends StatelessWidget {
  const _ProfileChevron();

  @override
  Widget build(BuildContext context) {
    return const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFFc4c9d2));
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  const _SectionHeader({required this.title, this.action});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title,
            style: const TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.6,
              color: Color(0xFF374151),
            ),
          ),
          if (action != null)
            InkWell(
              onTap: () {},
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(action!,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0a2f7f)),
                  ),
                  const Icon(Icons.chevron_right_rounded, size: 14, color: Color(0xFF0a2f7f)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  final String value;
  final String label;
  final bool highlight;
  const _StatCell({required this.value, required this.label, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
            style: TextStyle(
              fontSize: 17, fontWeight: FontWeight.w700,
              color: highlight ? const Color(0xFF16a373) : const Color(0xFF1f2937),
            ),
          ),
          const SizedBox(height: 1),
          Text(label,
            style: const TextStyle(fontSize: 10.5, color: Color(0xFF9ca3af)),
          ),
        ],
      ),
    );
  }
}

// ── Territory map preview ────────────────────────────────────
class _TerritoryMapPreview extends StatelessWidget {
  final double height;
  const _TerritoryMapPreview({this.height = 150});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFe9eef1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFeef0f3)),
      ),
      child: Stack(
        children: [
          // Simplified map SVG
          CustomPaint(
            size: Size.infinite,
            painter: _MapPainter(),
          ),
          // Region label
          Positioned(
            top: 10, left: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(14),
                boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 4)],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 6, height: 6, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF0a2f7f))),
                  const SizedBox(width: 6),
                  const Text('São Paulo · Zona Oeste',
                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF0a2f7f), letterSpacing: 0.3)),
                ],
              ),
            ),
          ),
          // Expand button
          Positioned(
            bottom: 10, right: 10,
            child: Container(
              width: 30, height: 30,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: const Color(0xFFeef0f3)),
                boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 4)],
              ),
              child: const Icon(Icons.open_in_full_rounded, size: 13, color: Color(0xFF374151)),
            ),
          ),
        ],
      ),
    );
  }
}

class _MapPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;

    // Region polygon (hatched)
    final path = Path()
      ..moveTo(size.width * 0.17, size.height * 0.19)
      ..lineTo(size.width * 0.33, size.height * 0.12)
      ..lineTo(size.width * 0.53, size.height * 0.20)
      ..lineTo(size.width * 0.62, size.height * 0.35)
      ..lineTo(size.width * 0.63, size.height * 0.63)
      ..lineTo(size.width * 0.53, size.height * 0.81)
      ..lineTo(size.width * 0.36, size.height * 0.81)
      ..lineTo(size.width * 0.22, size.height * 0.72)
      ..lineTo(size.width * 0.13, size.height * 0.52)
      ..close();

    paint.color = const Color(0x2E0a2f7f);
    canvas.drawPath(path, paint);
    paint.color = const Color(0xFF0a2f7f);
    paint.style = PaintingStyle.stroke;
    paint.strokeWidth = 2;
    canvas.drawPath(path, paint);

    // Clinic pins
    paint.style = PaintingStyle.fill;
    paint.color = const Color(0x8C0a2f7f);
    final pins = [
      Offset(size.width * 0.25, size.height * 0.30),
      Offset(size.width * 0.36, size.height * 0.37),
      Offset(size.width * 0.47, size.height * 0.28),
      Offset(size.width * 0.42, size.height * 0.52),
      Offset(size.width * 0.29, size.height * 0.55),
      Offset(size.width * 0.51, size.height * 0.59),
      Offset(size.width * 0.32, size.height * 0.70),
      Offset(size.width * 0.50, size.height * 0.73),
    ];
    for (final pin in pins) {
      canvas.drawCircle(pin, 3, paint);
    }

    // Rep location (green)
    final repPos = Offset(size.width * 0.39, size.height * 0.45);
    paint.color = const Color(0x2E16a373);
    canvas.drawCircle(repPos, 14, paint);
    paint.color = const Color(0xFF16a373);
    canvas.drawCircle(repPos, 7, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Preference row ───────────────────────────────────────────
class _PrefRow extends StatelessWidget {
  final Widget icon;
  final String label;
  final String sub;
  final Widget trailing;
  final bool showTopBorder;

  const _PrefRow({
    required this.icon,
    required this.label,
    required this.sub,
    required this.trailing,
    this.showTopBorder = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: showTopBorder ? const Border(top: BorderSide(color: Color(0xFFf1f3f6))) : null,
      ),
      child: Row(
        children: [
          icon,
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500, color: Color(0xFF1f2937))),
                const SizedBox(height: 2),
                Text(sub,
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF9ca3af)),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          trailing,
        ],
      ),
    );
  }
}

// ── Activity row ─────────────────────────────────────────────
class _ActivityRow extends StatelessWidget {
  final RecentActivity activity;
  const _ActivityRow({required this.activity});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: const Border(top: BorderSide(color: Color(0xFFf1f3f6))),
      ),
      child: Row(
        children: [
          _ActivityIcon(kind: activity.kind),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(activity.title,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF1f2937))),
                const SizedBox(height: 2),
                Text(activity.detail,
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF9ca3af)),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(activity.when,
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w500, color: Color(0xFF9ca3af))),
        ],
      ),
    );
  }
}

class _ActivityIcon extends StatelessWidget {
  final String kind;
  const _ActivityIcon({required this.kind});

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color color, IconData icon) = switch (kind) {
      'visit' => (const Color(0x140a2f7f), const Color(0xFF0a2f7f), Icons.location_on_outlined),
      'followup' => (const Color(0x1A16a373), const Color(0xFF16a373), Icons.check_circle_outline),
      'order' => (const Color(0x1Fc6861b), const Color(0xFFb07a10), Icons.shopping_bag_outlined),
      'download' => (const Color(0x1A1e40af), const Color(0xFF1e40af), Icons.download_outlined),
      _ => (const Color(0x140a2f7f), const Color(0xFF0a2f7f), Icons.circle_outlined),
    };

    return Container(
      width: 32, height: 32,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 14, color: color),
    );
  }
}

// ── Support row ──────────────────────────────────────────────
class _SupportRow extends StatelessWidget {
  final SupportItem item;
  const _SupportRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final icon = switch (item.kind) {
      'help' => Icons.help_outline_rounded,
      'chat' => Icons.chat_outlined,
      'legal' => Icons.description_outlined,
      _ => Icons.chevron_right_rounded,
    };

    return InkWell(
      onTap: () {},
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          border: const Border(top: BorderSide(color: Color(0xFFf1f3f6))),
        ),
        child: Row(
          children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: const Color(0x120a2f7f),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, size: 14, color: const Color(0xFF0a2f7f)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.label,
                    style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500, color: Color(0xFF1f2937))),
                  if (item.sub != null) ...[
                    const SizedBox(height: 2),
                    Text(item.sub!,
                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF9ca3af))),
                  ],
                ],
              ),
            ),
            const _ProfileChevron(),
          ],
        ),
      ),
    );
  }
}
