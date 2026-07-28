import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_blurhash/flutter_blurhash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/user_profile.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/preferences.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/core/user/controllers/avatar_controller.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';

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

  Future<void> _showAvatarActions(bool hasAvatar) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text("Escolher nova foto"),
              onTap: () {
                Navigator.pop(sheetContext);
                ref.read(avatarControllerProvider.notifier).chooseFromGallery();
              },
            ),
            if (hasAvatar)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: AppColors.red),
                title: const Text(
                  "Remover foto",
                  style: TextStyle(color: AppColors.red),
                ),
                onTap: () {
                  Navigator.pop(sheetContext);
                  ref.read(avatarControllerProvider.notifier).remove();
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showAvatarError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final sessionProfile = ref.watch(sessionProfileProvider);
    final currentUser = ref.watch(currentUserProvider);
    final profileAsync = ref.watch(profileProvider);
    final territoryAsync = ref.watch(territoryStatsProvider);
    final summaryAsync = ref.watch(quickSummaryProvider);
    final prefsAsync = ref.watch(preferencesProvider);
    ref.listen<AsyncValue<void>>(avatarControllerProvider, (_, next) {
      if (next.hasError) _showAvatarError(next.error.toString());
    });
    final avatarUpdating = ref.watch(avatarControllerProvider).isLoading;
    final avatarToken = ref.watch(sessionProvider).currentValue?.token;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Perfil'),
      body: Stack(
        children: [
          SafeArea(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [

                  // ── Header · identity ────────────────────────
                  sessionProfile.when(
                    loading: _buildHeaderSkeleton,
                    error: (_, _) => profileAsync.when(
                      loading: _buildHeaderSkeleton,
                      error: (_, _) => const SizedBox.shrink(),
                      data: (profile) =>
                          _buildHeader(profile, updating: avatarUpdating),
                    ),
                    data: (profile) => profile == null
                        ? profileAsync.when(
                            loading: _buildHeaderSkeleton,
                            error: (_, _) => const SizedBox.shrink(),
                            data: (fallback) => _buildHeader(
                              fallback,
                              updating: avatarUpdating,
                            ),
                          )
                        : _buildHeader(
                            profile,
                            avatarUrl: currentUser.valueOrNull?.avatarUrl,
                            avatarBlurhash:
                                currentUser.valueOrNull?.avatarBlurhash,
                            avatarToken: avatarToken,
                            updating: avatarUpdating,
                          ),
                  ),

                  // ── Body ─────────────────────────────────────
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Território
                        territoryAsync.when(
                          loading: () => _buildSectionSkeleton(height: 260),
                          error: (_, _) => const SizedBox.shrink(),
                          data: (stats) => _buildTerritory(stats),
                        ),
                        const SizedBox(height: 20),

                        // Resumo rápido
                        summaryAsync.when(
                          loading: () => _buildSummarySkeleton(),
                          error: (_, _) => const SizedBox.shrink(),
                          data: (items) => _buildQuickSummary(items),
                        ),
                        const SizedBox(height: 20),

                        // Preferências
                        prefsAsync.when(
                          loading: () => _buildSectionSkeleton(height: 250),
                          error: (_, _) => const SizedBox.shrink(),
                          data: (items) => _buildPreferences(items),
                        ),
                        const SizedBox(height: 20),

                        // Logout
                        _buildLogoutButton(),

                        // Footer
                        _buildFooter(sessionProfile.valueOrNull?.since ?? ''),
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

  // ── Header ──────────────────────────────────────────────────
  Widget _buildHeader(
    UserProfile profile, {
    String? avatarUrl,
    String? avatarBlurhash,
    String? avatarToken,
    bool updating = false,
  }) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0x120a2f7f), Color(0x050a2f7f), Colors.transparent],
        ),
      ),
      child: Column(
        children: [
          // Avatar + info
          Row(
            children: [
              _AvatarEditor(
                initials: profile.initials,
                avatarUrl: avatarUrl,
                avatarBlurhash: avatarBlurhash,
                avatarToken: avatarToken,
                updating: updating,
                onTap: () => _showAvatarActions(
                  avatarUrl != null && avatarUrl.isNotEmpty,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      profile.displayName,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.4,
                        color: AppColors.gray800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      profile.role,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.gray500,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Region chip
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0x140a2f7f),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.location_on_outlined,
                            size: 10,
                            color: AppColors.navyDeep,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            profile.region,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.2,
                              color: AppColors.navyDeep,
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

  Widget _buildHeaderSkeleton() {
    return AtlasShimmer(
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0x120a2f7f), Color(0x050a2f7f), Colors.transparent],
          ),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 66,
                  height: 66,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.surfaceSecondary,
                  ),
                ),
                const SizedBox(width: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 150,
                      height: 14,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSecondary,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: 100,
                      height: 10,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSecondary,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Território ──────────────────────────────────────────────
  Widget _buildTerritory(TerritoryStats stats) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: 'Território',
          action: 'Abrir mapa',
          onAction: () => context.go('/map'),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.surfaceSecondary),
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
                    Container(width: 1, height: 28, color: AppColors.gray100),
                    _StatCell(value: '${stats.doctors}', label: 'médicos'),
                    Container(width: 1, height: 28, color: AppColors.gray100),
                    _StatCell(
                      value: '${stats.coveragePct}%',
                      label: 'cobertura',
                      highlight: true,
                    ),
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
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.gray700,
                            ),
                            children: [
                              const TextSpan(text: 'Você cobriu '),
                              TextSpan(
                                text: '${stats.coveragePct}%',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.green,
                                ),
                              ),
                              const TextSpan(text: ' da sua região'),
                            ],
                          ),
                        ),
                        Text(
                          stats.coverageWeek,
                          style: const TextStyle(
                            fontSize: 10.5,
                            color: AppColors.gray400,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      height: 5,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSecondary,
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: FractionallySizedBox(
                        widthFactor: stats.coveragePct / 100,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.green, AppColors.green600],
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
          children: items
              .map(
                (item) => Expanded(
                  child: Container(
                    margin: EdgeInsets.only(right: items.last == item ? 0 : 8),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: AppColors.surfaceSecondary),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.value,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: Color(item.color),
                            letterSpacing: -0.5,
                            height: 1,
                          ),
                        ),
                        const SizedBox(height: 7),
                        Text(
                          item.label,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.gray800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          item.sub,
                          style: const TextStyle(
                            fontSize: 10.5,
                            color: AppColors.gray400,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }

  Widget _buildSummarySkeleton() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Resumo rápido'),
        const SizedBox(height: 8),
        AtlasShimmer(
          child: Row(
            children: List.generate(
              3,
              (i) => Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: i < 2 ? 8 : 0),
                  height: 88,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: AppColors.surfaceSecondary),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          height: 14,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceSecondary,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Container(
                          width: 50,
                          height: 8,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceSecondary,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
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
            border: Border.all(color: AppColors.surfaceSecondary),
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
                    ? _ProfileToggle(
                        value: item.value,
                        accent: AppColors.navyDeep,
                      )
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
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: const Color(0x120a2f7f),
        borderRadius: BorderRadius.circular(9),
      ),
      child: Center(
        child: Icon(_prefIconData(label), size: 14, color: AppColors.navyDeep),
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

  // ── Suporte & conta ─────────────────────────────────────────
  // Removed — pending real API support endpoints.

  // ── Logout button ───────────────────────────────────────────
  Widget _buildLogoutButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () => setState(() => _logoutConfirm = true),
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14),
          side: const BorderSide(color: Color(0x38b84545)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          backgroundColor: Colors.white,
        ),
        icon: const Icon(Icons.logout_rounded, size: 15, color: AppColors.red),
        label: const Text(
          'Sair da conta',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.red,
          ),
        ),
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
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x2E000000),
                      blurRadius: 32,
                      offset: Offset(0, -8),
                    ),
                  ],
                ),
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Handle
                    Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.gray200,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 18),
                    // Icon
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: const Color(0x1Ab84545),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        Icons.logout_rounded,
                        size: 22,
                        color: AppColors.red,
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Sair da conta?',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray800,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Você precisará fazer login novamente para\nacessar seus pedidos, visitas e rotas.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.gray500,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () {
                          ref.read(sessionProvider).delete();
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.red,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          'Sair',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => setState(() => _logoutConfirm = false),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: const BorderSide(
                            color: AppColors.surfaceSecondary,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text(
                          'Cancelar',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w500,
                            color: AppColors.gray700,
                          ),
                        ),
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
        child: Text(
          since.isEmpty ? 'Atlasmed · v0.1.0' : 'Atlasmed · v0.1.0 · $since',
          style: const TextStyle(
            fontSize: 10.5,
            color: AppColors.gray300,
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }

  // ── Skeleton placeholder for sections ────────────────────────
  Widget _buildSectionSkeleton({double height = 200}) {
    return AtlasShimmer(
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.surfaceSecondary),
          borderRadius: BorderRadius.circular(14),
        ),
      ),
    );
  }
}

// ======================================================================
// Shared components
// ======================================================================

class _AvatarEditor extends StatelessWidget {
  const _AvatarEditor({
    required this.initials,
    required this.avatarUrl,
    required this.avatarBlurhash,
    required this.avatarToken,
    required this.updating,
    required this.onTap,
  });

  final String initials;
  final String? avatarUrl;
  final String? avatarBlurhash;
  final String? avatarToken;
  final bool updating;
  final VoidCallback onTap;

  String? _absoluteAvatarUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    return url.startsWith("http") ? url : "${AppConfig.apiBaseUrl}$url";
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: "Alterar foto de perfil",
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          _ProfileAvatar(
            initials: initials,
            imageUrl: _absoluteAvatarUrl(avatarUrl),
            blurhash: avatarBlurhash,
            authorization: avatarToken == null ? null : "Bearer $avatarToken",
            size: 66,
          ),
          Positioned(
            right: -2,
            bottom: -2,
            child: Material(
              color: AppColors.navyDeep,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: updating ? null : onTap,
                child: SizedBox(
                  width: 28,
                  height: 28,
                  child: updating
                      ? const Padding(
                          padding: EdgeInsets.all(7),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(
                          Icons.camera_alt_outlined,
                          size: 15,
                          color: Colors.white,
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  final String initials;
  final String? imageUrl;
  final String? blurhash;
  final String? authorization;
  final double size;
  const _ProfileAvatar({
    required this.initials,
    this.imageUrl,
    this.blurhash,
    this.authorization,
    this.size = 72,
  });

  @override
  Widget build(BuildContext context) {
    final hash = blurhash?.trim();
    final hasBlurhash = hash != null && hash.isNotEmpty;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.navyDeep, AppColors.navyBright, AppColors.green],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.navyDeep.withValues(alpha: 0.22),
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
      clipBehavior: Clip.antiAlias,
      child: imageUrl != null && imageUrl!.isNotEmpty
          ? CachedNetworkImage(
              imageUrl: imageUrl!,
              httpHeaders: authorization == null
                  ? null
                  : {"Authorization": authorization!},
              fit: BoxFit.cover,
              placeholder: (_, _) =>
                  hasBlurhash ? BlurHash(hash: hash) : _initials(),
              errorWidget: (_, _, _) => _initials(),
            )
          : _initials(),
    );
  }

  Widget _initials() {
    return Center(
      child: Text(
        initials,
        style: TextStyle(
          fontSize: size * 0.36,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: Colors.white,
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
        width: 38,
        height: 22,
        decoration: BoxDecoration(
          color: _value ? widget.accent : AppColors.gray200,
          borderRadius: BorderRadius.circular(11),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          alignment: _value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 18,
            height: 18,
            margin: const EdgeInsets.symmetric(horizontal: 2),
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
    return const Icon(
      Icons.chevron_right_rounded,
      size: 18,
      color: AppColors.gray300,
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;
  const _SectionHeader({required this.title, this.action, this.onAction});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: AppColors.gray700,
            ),
          ),
          if (action != null)
            InkWell(
              onTap: onAction,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    action!,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.navyDeep,
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 14,
                    color: AppColors.navyDeep,
                  ),
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
  const _StatCell({
    required this.value,
    required this.label,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: highlight ? AppColors.green : AppColors.gray800,
            ),
          ),
          const SizedBox(height: 1),
          Text(
            label,
            style: const TextStyle(fontSize: 10.5, color: AppColors.gray400),
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
        color: AppColors.surfaceSecondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Stack(
        children: [
          // Simplified map SVG
          CustomPaint(size: Size.infinite, painter: _MapPainter()),
          // Region label
          Positioned(
            top: 10,
            left: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(14),
                boxShadow: const [
                  BoxShadow(color: Color(0x14000000), blurRadius: 4),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.navyDeep,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'São Paulo · Zona Oeste',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navyDeep,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Expand button
          Positioned(
            bottom: 10,
            right: 10,
            child: Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: AppColors.surfaceSecondary),
                boxShadow: const [
                  BoxShadow(color: Color(0x14000000), blurRadius: 4),
                ],
              ),
              child: const Icon(
                Icons.open_in_full_rounded,
                size: 13,
                color: AppColors.gray700,
              ),
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
    paint.color = AppColors.navyDeep;
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
    paint.color = AppColors.green;
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
        border: showTopBorder
            ? const Border(top: BorderSide(color: AppColors.gray100))
            : null,
      ),
      child: Row(
        children: [
          icon,
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w500,
                    color: AppColors.gray800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sub,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: AppColors.gray400,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
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
