import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/bookmarks_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/doctor_row.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

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
class FavoritosScreen extends StatefulWidget {
  const FavoritosScreen({super.key});

  @override
  State<FavoritosScreen> createState() => _FavoritosScreenState();
}

class _FavoritosScreenState extends State<FavoritosScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: const AtlasAppBar(page: 'Favoritos'),
      body: Column(
        children: [
          TabBar(
            controller: _tabs,
            labelColor: AppColors.navyBright,
            unselectedLabelColor: AppColors.gray500,
            indicatorColor: AppColors.navyBright,
            tabs: const [
              Tab(text: 'Clínicas'),
              Tab(text: 'Médicos'),
            ],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: const [_ClinicsTab(), _DoctorsTab()],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyFavoritos extends StatelessWidget {
  const _EmptyFavoritos({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.bookmark_border_rounded,
              size: 40,
              color: AppColors.gray500,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.gray500),
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

class _ClinicsTab extends ConsumerWidget {
  const _ClinicsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(clinicBookmarksProvider(1));

    return page.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => _LoadFailed(
        onRetry: () => ref.invalidate(clinicBookmarksProvider(1)),
      ),
      data: (result) {
        if (result.items.isEmpty) {
          return const _EmptyFavoritos(
            message:
                'Nenhuma clínica salva ainda. Toque no marcador na página de '
                'uma clínica para salvá-la aqui.',
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(clinicBookmarksProvider(1)),
          child: ListView.builder(
            itemCount: result.items.length,
            itemBuilder: (context, index) {
              final clinic = result.items[index];
              return ClinicRow(
                clinic: FacilityEntry.fromDTO(clinic),
                onTap: () => ClinicDetailRoute(id: clinic.id).push(context),
              );
            },
          ),
        );
      },
    );
  }
}

class _DoctorsTab extends ConsumerWidget {
  const _DoctorsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(doctorBookmarksProvider(1));

    return page.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => _LoadFailed(
        onRetry: () => ref.invalidate(doctorBookmarksProvider(1)),
      ),
      data: (result) {
        if (result.items.isEmpty) {
          return const _EmptyFavoritos(
            message:
                'Nenhum médico salvo ainda. Toque no marcador na página de '
                'um médico para salvá-lo aqui.',
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(doctorBookmarksProvider(1)),
          child: ListView.builder(
            itemCount: result.items.length,
            itemBuilder: (context, index) {
              final doctor = result.items[index];
              return DoctorRow(
                doctor: ProfessionalEntry.fromDTO(doctor),
                onTap: () => DoctorDetailRoute(id: doctor.id).push(context),
              );
            },
          ),
        );
      },
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
