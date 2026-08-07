import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shows a "Linha comercial" chip row when the user has 2+ business verticals.
///
/// By default selecting a chip updates [selectedFacilityVerticalIdProvider];
/// "Todas as linhas" clears the filter (API union). Hidden for 0–1 verticals.
///
/// When [allowedVerticalIds] is set, options are intersected with that set
/// (e.g. current clinic's verticals). Still requires 2+ options after filter.
///
/// Pass [syncExploreSelection]: false + [selectedVerticalId] for clinic-local
/// scope that must not mutate the Explorar filter.
class FacilityVerticalFilterBar extends ConsumerWidget {
  const FacilityVerticalFilterBar({
    super.key,
    this.padding = const EdgeInsets.fromLTRB(16, 0, 16, 8),
    this.onChanged,
    this.allowedVerticalIds,
    this.allowAll = true,
    this.syncExploreSelection = true,
    this.selectedVerticalId,
  });

  final EdgeInsetsGeometry padding;
  final ValueChanged<int?>? onChanged;

  /// If non-null, only these vertical ids are offered (intersection with user).
  final Set<int>? allowedVerticalIds;

  /// When false, omits "Todas as linhas".
  final bool allowAll;

  /// When false, does not write [selectedFacilityVerticalIdProvider].
  final bool syncExploreSelection;

  /// Controlled selection (clinic-local). When null and [syncExploreSelection],
  /// uses Explorar provider.
  final int? selectedVerticalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final optionsAsync = ref.watch(currentUserFacilityVerticalOptionsProvider);
    final exploreSelected = ref.watch(selectedFacilityVerticalIdProvider);

    return optionsAsync.maybeWhen(
      data: (options) {
        final filtered = _filterOptions(options, allowedVerticalIds);
        if (filtered.length < 2) return const SizedBox.shrink();

        final selected = syncExploreSelection
            ? exploreSelected
            : selectedVerticalId;
        final effectiveSelected =
            selected != null && filtered.any((v) => v.id == selected)
            ? selected
            : (allowAll ? null : filtered.first.id);

        return Padding(
          padding: padding,
          child: VerticalSelector(
            verticals: filtered,
            selectedVerticalId: effectiveSelected,
            allowAll: allowAll,
            onChanged: (verticalId) {
              if (syncExploreSelection) {
                ref.read(selectedFacilityVerticalIdProvider.notifier).state =
                    verticalId;
              }
              onChanged?.call(verticalId);
            },
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }

  static List<BusinessVertical> _filterOptions(
    List<BusinessVertical> options,
    Set<int>? allowed,
  ) {
    if (allowed == null) return options;
    if (allowed.isEmpty) return const [];
    return options.where((v) => allowed.contains(v.id)).toList(growable: false);
  }
}
