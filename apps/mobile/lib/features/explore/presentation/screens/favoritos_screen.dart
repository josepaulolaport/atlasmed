import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/bookmarks_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/doctor_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/tab_toggle.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Favoritos — the caller's saved clinics and doctors.
///
/// Two tabs rather than one merged list: each reuses the row widget Explore
/// already renders, so a saved clinic looks exactly like a searched one and
/// there is no third card to keep in step. A merged list would also need one
/// paging cursor across two tables.
///
/// Deliberately not a filter on the Explore list. Bookmarks are per-user and
/// the Explore search path is Meilisearch, whose documents are shared between
/// users — expressing "mine" there would mean reindexing a clinic on every
/// toggle. This page asks Postgres directly instead.
class FavoritosScreen extends ConsumerStatefulWidget {
  const FavoritosScreen({super.key});

  @override
  ConsumerState<FavoritosScreen> createState() => _FavoritosScreenState();
}

class _FavoritosScreenState extends ConsumerState<FavoritosScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this)
    // Keeps the toggle in step when the tab changes by swipe rather than tap.
    ..addListener(() {
      if (mounted) setState(() {});
    });

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Page 1 of each list is already being watched by the tabs below, so
    // reading the totals here costs no extra request.
    final clinicTotal =
        ref.watch(clinicBookmarksProvider(1)).valueOrNull?.pagination.total ??
        0;
    final doctorTotal =
        ref.watch(doctorBookmarksProvider(1)).valueOrNull?.pagination.total ??
        0;

    return Scaffold(
      backgroundColor: Colors.white,

      /// A pushed screen, so it carries a back arrow and its own title rather
      /// than [AtlasAppBar], which is the top-level nav shell (hamburger +
      /// breadcrumb) and would suggest Favoritos is a destination of its own.
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
                  const Expanded(
                    child: Text(
                      'Favoritos',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            // Explorar's own tabs, not Material's.
            //
            // This screen shows the same Clínicas/Médicos choice as the list it
            // is opened from, one tap away, and drew it as a plain `TabBar` —
            // different type scale, different indicator, no counts. Two designs
            // for one control.
            TabToggle(
              value: _tabs.index == 0 ? 'clinic' : 'doctor',
              clinicCount: clinicTotal,
              doctorCount: doctorTotal,
              onChanged: (value) => _tabs.animateTo(value == 'clinic' ? 0 : 1),
            ),
            Expanded(
              child: TabBarView(
                controller: _tabs,
                children: const [_ClinicsTab(), _DoctorsTab()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadingRows extends StatelessWidget {
  const _LoadingRows({required this.isDoctor});

  final bool isDoctor;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: 6,
      itemBuilder: (context, _) => SkeletonRow(isDoctor: isDoctor),
    );
  }
}

/// The same shape as the Explore list's empty state — circle, title, then the
/// explanation — rather than a fourth way of saying "nothing here".
class _EmptyFavoritos extends StatelessWidget {
  const _EmptyFavoritos({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 60),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.gray100,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.bookmark_border_rounded,
                size: 32,
                color: AppColors.gray400,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.gray500,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadFailed extends StatelessWidget {
  const _LoadFailed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Não foi possível carregar os favoritos'),
          const SizedBox(height: 8),
          TextButton(onPressed: onRetry, child: const Text('Tentar novamente')),
        ],
      ),
    );
  }
}

class _ClinicsTab extends ConsumerStatefulWidget {
  const _ClinicsTab();

  @override
  ConsumerState<_ClinicsTab> createState() => _ClinicsTabState();
}

class _ClinicsTabState extends ConsumerState<_ClinicsTab> {
  int _loadedPages = 1;

  @override
  Widget build(BuildContext context) {
    final pages = [
      for (var page = 1; page <= _loadedPages; page++)
        ref.watch(clinicBookmarksProvider(page)),
    ];
    final items = [for (final page in pages) ...?page.valueOrNull?.items];
    final last = pages.last;
    final total = pages.first.valueOrNull?.pagination.total ?? 0;
    final hasMore = items.length < total;

    if (pages.first.isLoading) return const _LoadingRows(isDoctor: false);
    if (pages.first.hasError) {
      return _LoadFailed(
        onRetry: () => ref.invalidate(clinicBookmarksProvider(1)),
      );
    }
    if (items.isEmpty) {
      return const _EmptyFavoritos(
        title: 'Nenhuma clínica salva',
        message:
            'Toque no marcador na página de uma clínica para salvá-la aqui.',
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        for (var page = 1; page <= _loadedPages; page++) {
          ref.invalidate(clinicBookmarksProvider(page));
        }
        setState(() => _loadedPages = 1);
      },
      child: ListView.builder(
        // One extra row while more pages exist: it both loads the next page and
        // shows the shimmer, so reaching the end never looks like the end.
        itemCount: items.length + (hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= items.length) {
            if (!last.isLoading) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _loadedPages += 1);
              });
            }
            return const SkeletonRow(isDoctor: false);
          }
          final clinic = items[index];
          return ClinicRow(
            clinic: FacilityEntry.fromDTO(clinic),
            onTap: () => ClinicDetailRoute(id: clinic.id).push(context),
          );
        },
      ),
    );
  }
}

class _DoctorsTab extends ConsumerStatefulWidget {
  const _DoctorsTab();

  @override
  ConsumerState<_DoctorsTab> createState() => _DoctorsTabState();
}

class _DoctorsTabState extends ConsumerState<_DoctorsTab> {
  int _loadedPages = 1;

  @override
  Widget build(BuildContext context) {
    final pages = [
      for (var page = 1; page <= _loadedPages; page++)
        ref.watch(doctorBookmarksProvider(page)),
    ];
    final items = [for (final page in pages) ...?page.valueOrNull?.items];
    final last = pages.last;
    final total = pages.first.valueOrNull?.pagination.total ?? 0;
    final hasMore = items.length < total;

    if (pages.first.isLoading) return const _LoadingRows(isDoctor: true);
    if (pages.first.hasError) {
      return _LoadFailed(
        onRetry: () => ref.invalidate(doctorBookmarksProvider(1)),
      );
    }
    if (items.isEmpty) {
      return const _EmptyFavoritos(
        title: 'Nenhum médico salvo',
        message: 'Toque no marcador na página de um médico para salvá-lo aqui.',
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        for (var page = 1; page <= _loadedPages; page++) {
          ref.invalidate(doctorBookmarksProvider(page));
        }
        setState(() => _loadedPages = 1);
      },
      child: ListView.builder(
        itemCount: items.length + (hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= items.length) {
            if (!last.isLoading) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _loadedPages += 1);
              });
            }
            return const SkeletonRow(isDoctor: true);
          }
          final doctor = items[index];
          return DoctorRow(
            doctor: ProfessionalEntry.fromDTO(doctor),
            onTap: () => DoctorDetailRoute(id: doctor.id).push(context),
          );
        },
      ),
    );
  }
}

/// The Explorar entry point.
///
/// No count badge: a number would cost a request on every Explore render for
/// something nobody acts on, and it would need invalidating after every toggle.
class FavoritosAppBarButton extends StatelessWidget {
  const FavoritosAppBarButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Favoritos',
      icon: const Icon(Icons.bookmark_border_rounded),
      color: AppColors.gray500,
      onPressed: () => const FavoritosRoute().push(context),
    );
  }
}
