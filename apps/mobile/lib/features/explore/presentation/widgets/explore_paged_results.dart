import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/doctor_list_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/doctor_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/empty_state.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class ExplorePageIndex {
  const ExplorePageIndex({required this.page, required this.offset});

  factory ExplorePageIndex.fromGlobalIndex(int index, {required int pageSize}) {
    return ExplorePageIndex(
      page: index ~/ pageSize + 1,
      offset: index % pageSize,
    );
  }

  final int page;
  final int offset;

  @override
  bool operator ==(Object other) =>
      other is ExplorePageIndex && page == other.page && offset == other.offset;

  @override
  int get hashCode => Object.hash(page, offset);
}

class ClinicsPagedResults extends ConsumerWidget {
  const ClinicsPagedResults({
    required this.query,
    required this.bottomInset,
    this.preferredVerticalId,
    this.onRefresh,
    super.key,
  });

  final ClinicsQuery query;
  final double bottomInset;
  final String? preferredVerticalId;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final firstPageQuery = query.copyWith(page: 1);
    final firstPage = ref.watch(clinicsPageProvider(firstPageQuery));
    return firstPage.when(
      skipLoadingOnRefresh: false,
      loading: () => const _ExploreListSkeleton(isDoctor: false),
      error: (_, _) => _PageError(
        onRetry: () => ref.invalidate(clinicsPageProvider(firstPageQuery)),
      ),
      data: (data) {
        if (data.pagination.total == 0) {
          return _RefreshableList(
            onRefresh: onRefresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              children: [
                SizedBox(
                  height: MediaQuery.sizeOf(context).height * 0.6,
                  child: EmptyState(
                    query: query.searchQuery ?? '',
                    kind: 'clinic',
                  ),
                ),
              ],
            ),
          );
        }
        return _RefreshableList(
          onRefresh: onRefresh,
          child: ListView.builder(
            key: const ValueKey('clinics-paged-results'),
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            // ignore: deprecated_member_use
            cacheExtent: 900,
            itemCount: data.pagination.total + 1,
            itemBuilder: (context, index) {
              if (index == data.pagination.total) {
                return SizedBox(height: bottomInset);
              }
              return _ClinicPagedRow(
                key: ValueKey('clinic-row-$index'),
                query: query,
                index: index,
                preferredVerticalId: preferredVerticalId,
              );
            },
          ),
        );
      },
    );
  }
}

class DoctorsPagedResults extends ConsumerWidget {
  const DoctorsPagedResults({
    required this.query,
    required this.bottomInset,
    this.onRefresh,
    super.key,
  });

  final DoctorsQuery query;
  final double bottomInset;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final firstPageQuery = query.copyWith(page: 1);
    final firstPage = ref.watch(doctorsPageProvider(firstPageQuery));
    return firstPage.when(
      skipLoadingOnRefresh: false,
      loading: () => const _ExploreListSkeleton(isDoctor: true),
      error: (_, _) => _PageError(
        onRetry: () => ref.invalidate(doctorsPageProvider(firstPageQuery)),
      ),
      data: (data) {
        if (data.pagination.total == 0) {
          return _RefreshableList(
            onRefresh: onRefresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(
                parent: BouncingScrollPhysics(),
              ),
              children: [
                SizedBox(
                  height: MediaQuery.sizeOf(context).height * 0.6,
                  child: EmptyState(
                    query: query.searchQuery ?? '',
                    kind: 'doctor',
                  ),
                ),
              ],
            ),
          );
        }
        return _RefreshableList(
          onRefresh: onRefresh,
          child: ListView.builder(
            key: const ValueKey('doctors-paged-results'),
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            // ignore: deprecated_member_use
            cacheExtent: 900,
            itemCount: data.pagination.total + 1,
            itemBuilder: (context, index) {
              if (index == data.pagination.total) {
                return SizedBox(height: bottomInset);
              }
              return _DoctorPagedRow(
                key: ValueKey('doctor-row-$index'),
                query: query,
                index: index,
              );
            },
          ),
        );
      },
    );
  }
}

class _ClinicPagedRow extends ConsumerWidget {
  const _ClinicPagedRow({
    required this.query,
    required this.index,
    this.preferredVerticalId,
    super.key,
  });

  final ClinicsQuery query;
  final int index;
  final String? preferredVerticalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final position = ExplorePageIndex.fromGlobalIndex(
      index,
      pageSize: query.limit,
    );
    final pageQuery = query.copyWith(page: position.page);
    final page = ref.watch(clinicsPageProvider(pageQuery));
    return page.when(
      loading: () => const SkeletonRow(isDoctor: false),
      error: (_, _) => _PageError(
        compact: true,
        onRetry: () => ref.invalidate(clinicsPageProvider(pageQuery)),
      ),
      data: (data) {
        if (position.offset >= data.items.length) {
          return const SizedBox.shrink();
        }
        final clinic = FacilityEntry.fromDTO(data.items[position.offset]);
        return ClinicRow(
          clinic: clinic,
          onTap: () {
            final verticalId = preferredVerticalId;
            if (verticalId != null && verticalId.isNotEmpty) {
              context.push(
                Uri(
                  path: '/explore/clinic/${clinic.id}',
                  queryParameters: {'verticalId': verticalId},
                ).toString(),
              );
              return;
            }
            context.push('/explore/clinic/${clinic.id}');
          },
        );
      },
    );
  }
}

class _DoctorPagedRow extends ConsumerWidget {
  const _DoctorPagedRow({required this.query, required this.index, super.key});

  final DoctorsQuery query;
  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final position = ExplorePageIndex.fromGlobalIndex(
      index,
      pageSize: query.limit,
    );
    final pageQuery = query.copyWith(page: position.page);
    final page = ref.watch(doctorsPageProvider(pageQuery));
    return page.when(
      loading: () => const SkeletonRow(isDoctor: true),
      error: (_, _) => _PageError(
        compact: true,
        onRetry: () => ref.invalidate(doctorsPageProvider(pageQuery)),
      ),
      data: (data) {
        if (position.offset >= data.items.length) {
          return const SizedBox.shrink();
        }
        final doctor = ProfessionalEntry.fromDTO(data.items[position.offset]);
        return DoctorRow(
          doctor: doctor,
          onTap: () => context.push('/explore/doctor/${doctor.id}'),
        );
      },
    );
  }
}

class _RefreshableList extends StatelessWidget {
  const _RefreshableList({required this.child, this.onRefresh});

  final Widget child;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final refresh = onRefresh;
    return refresh == null
        ? child
        : RefreshIndicator(onRefresh: refresh, child: child);
  }
}

class _ExploreListSkeleton extends StatelessWidget {
  const _ExploreListSkeleton({required this.isDoctor});

  final bool isDoctor;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: 8,
      itemBuilder: (_, _) => SkeletonRow(isDoctor: isDoctor),
    );
  }
}

class _PageError extends StatelessWidget {
  const _PageError({required this.onRetry, this.compact = false});

  final VoidCallback onRetry;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(compact ? 8 : 24),
        child: TextButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Tentar novamente'),
        ),
      ),
    );
  }
}
