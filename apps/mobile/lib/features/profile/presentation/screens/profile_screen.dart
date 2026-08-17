import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_blurhash/flutter_blurhash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/core/session/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/config/app_version_provider.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/user_profile.dart';
import 'package:atlasmed_mobile_app/features/profile/data/models/preferences.dart';
import 'package:atlasmed_mobile_app/features/profile/data/user_preferences.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/providers/profile_provider.dart';
import 'package:atlasmed_mobile_app/features/profile/presentation/widgets/working_hours_sheet.dart';
import 'package:atlasmed_mobile_app/core/user/controllers/avatar_controller.dart';
import 'package:atlasmed_mobile_app/core/user/repositories/user_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';

// ======================================================================
// ProfileScreen — representative's personal overview
// ======================================================================

const _monthNames = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

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
                        // Conta
                        profileAsync.when(
                          loading: () => _buildSectionSkeleton(height: 190),
                          error: (_, _) => const SizedBox.shrink(),
                          data: _buildAccount,
                        ),
                        const SizedBox(height: 20),

                        // Território and Resumo rápido used to sit here. Both
                        // said what Desempenho says, less well and from a
                        // second query — which is how the two came to disagree
                        // about the same book, 184 médicos against 214. A
                        // profile is for who you are and what you can change,
                        // not for a second opinion on your numbers.

                        // Preferências
                        prefsAsync.when(
                          loading: () => _buildSectionSkeleton(height: 250),
                          error: (_, _) => const SizedBox.shrink(),
                          data: (items) => _buildPreferences(
                            items,
                            onEditHours: () => _editWorkingHours(ref),
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Logout
                        _buildLogoutButton(),

                        // Footer
                        _buildFooter(
                          sessionProfile.valueOrNull?.memberSince ??
                              profileAsync.valueOrNull?.memberSince,
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

  // ── Conta ───────────────────────────────────────────────────
  /// Who the account says you are, and the one part of it you may change.
  ///
  /// The screen showed a name, a role and a region and nothing else — the
  /// e-mail and telephone were on the model the whole time and never drawn, so
  /// a rep could not check the address a password reset would go to.
  ///
  /// Only the name is editable, because `PATCH /user` accepts only the name.
  /// E-mail, telephone and username identify the account rather than describe
  /// the person, and changing them is an administrator's job — the rows say so
  /// rather than offering a tap that would fail.
  Widget _buildAccount(UserProfile profile) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'Conta'),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: AppColors.surfaceSecondary),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: [
              _AccountRow(
                key: const Key('profile-account-name'),
                icon: Icons.badge_outlined,
                label: 'Nome',
                value: profile.displayName,
                onTap: () => _editName(profile),
              ),
              _AccountRow(
                icon: Icons.alternate_email_rounded,
                label: 'E-mail',
                value: profile.email,
                showTopBorder: true,
              ),
              _AccountRow(
                icon: Icons.phone_outlined,
                label: 'Telefone',
                value: profile.phone?.trim().isNotEmpty == true
                    ? profile.phone!
                    : 'Não informado',
                muted: profile.phone?.trim().isNotEmpty != true,
                showTopBorder: true,
              ),
              if (profile.username case final username?
                  when username.isNotEmpty)
                _AccountRow(
                  icon: Icons.person_outline_rounded,
                  label: 'Usuário',
                  value: username,
                  showTopBorder: true,
                ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(4, 8, 4, 0),
          child: Text(
            'E-mail, telefone e usuário são alterados pelo administrador.',
            style: TextStyle(fontSize: 11.5, color: AppColors.gray500),
          ),
        ),
      ],
    );
  }

  Future<void> _editName(UserProfile profile) async {
    final messenger = ScaffoldMessenger.of(context);
    final saved = await showModalBottomSheet<({String first, String last})>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _NameSheet(
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
      ),
    );
    if (saved == null) return;

    try {
      await ref
          .read(userProvider)
          .updateName(firstName: saved.first, lastName: saved.last);
      if (!mounted) return;
      // Everything that reads a name hangs off the user, so the whole screen —
      // header, initials, drawer — follows from this one invalidation.
      ref.invalidate(currentUserProvider);
      ref.invalidate(profileProvider);
      ref.invalidate(sessionProfileProvider);
      messenger.showSnackBar(const SnackBar(content: Text('Nome atualizado.')));
    } on UserUpdateException catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  // ── Preferências ────────────────────────────────────────────
  /// Lets the rep say when they actually work — spec 0016 §15.5.5.
  ///
  /// Until this, every rep in a linha was planned against one set of hours, so
  /// a rep who starts at 06:00 lost two hours of their day, every day.
  Future<void> _editWorkingHours(WidgetRef ref) async {
    final repo = ref.read(userPreferencesProvider);
    final current = await repo.currentValueOrResolve();
    if (current == null || !mounted) return;

    final payload = await showModalBottomSheet<UpdateUserPreferencesPayload>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => WorkingHoursSheet(current: current),
    );
    if (payload == null) return;

    await repo.patch(payload);
    ref.invalidate(preferencesProvider);
  }

  Widget _buildPreferences(
    List<PreferenceItem> items, {
    required Future<void> Function() onEditHours,
  }) {
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
                onTap: item.label == 'Horário de trabalho'
                    ? onEditHours
                    : (item.onTap == null ? null : () => item.onTap!()),
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
  Widget _buildFooter(DateTime? memberSince) {
    final version = ref.watch(appVersionProvider).valueOrNull ?? '';
    // `since` was a string that defaulted to empty and was never filled in, so
    // this half of the line could not appear. The account's own creation date
    // was on the user all along.
    final since = memberSince == null
        ? ''
        : 'desde ${_monthNames[memberSince.month - 1]} ${memberSince.year}';
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Center(
        child: Text(
          since.isEmpty
              ? 'Atlasmed · $version'
              : 'Atlasmed · $version · $since',
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
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 2),
    child: Text(
      title,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
        color: AppColors.gray700,
      ),
    ),
  );
}

/// One fact about the account. Tappable only when it can actually be changed.
class _AccountRow extends StatelessWidget {
  const _AccountRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.onTap,
    this.muted = false,
    this.showTopBorder = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback? onTap;
  final bool muted;
  final bool showTopBorder;

  @override
  Widget build(BuildContext context) {
    final row = Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        border: showTopBorder
            ? const Border(top: BorderSide(color: AppColors.surfaceSecondary))
            : null,
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0x120a2f7f),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Center(
              child: Icon(icon, size: 14, color: AppColors.navyDeep),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: muted ? AppColors.gray400 : AppColors.gray900,
                  ),
                ),
              ],
            ),
          ),
          if (onTap != null) _ProfileChevron(),
        ],
      ),
    );

    if (onTap == null) return row;
    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: onTap, child: row),
    );
  }
}

/// The rename form. Two fields, because that is what the endpoint takes.
class _NameSheet extends StatefulWidget {
  const _NameSheet({required this.firstName, required this.lastName});

  final String firstName;
  final String lastName;

  @override
  State<_NameSheet> createState() => _NameSheetState();
}

class _NameSheetState extends State<_NameSheet> {
  late final _first = TextEditingController(text: widget.firstName);
  late final _last = TextEditingController(text: widget.lastName);

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    super.dispose();
  }

  bool get _valid =>
      _first.text.trim().isNotEmpty && _last.text.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        12 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Seu nome',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'É assim que você aparece para o seu gerente e nos relatórios.',
            style: TextStyle(fontSize: 12, color: AppColors.gray500),
          ),
          const SizedBox(height: 16),
          TextField(
            key: const Key('profile-first-name'),
            controller: _first,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Nome',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('profile-last-name'),
            controller: _last,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Sobrenome',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 18),
          FilledButton(
            key: const Key('profile-name-save'),
            onPressed: _valid
                ? () => Navigator.of(
                    context,
                  ).pop((first: _first.text.trim(), last: _last.text.trim()))
                : null,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.navyBright,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('Salvar'),
          ),
        ],
      ),
    ),
  );
}

// ── Preference row ───────────────────────────────────────────
class _PrefRow extends StatelessWidget {
  final Widget icon;
  final String label;
  final String sub;
  final Widget trailing;
  final bool showTopBorder;
  final VoidCallback? onTap;

  const _PrefRow({
    required this.icon,
    required this.label,
    required this.sub,
    required this.trailing,
    this.showTopBorder = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final row = _content();
    return onTap == null
        ? row
        : InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(14),
            child: row,
          );
  }

  Widget _content() {
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
