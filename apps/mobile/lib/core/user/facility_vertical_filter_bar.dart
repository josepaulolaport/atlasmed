import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shows a "Linha comercial" chip row when the user has 2+ business verticals.
///
/// Selecting a chip updates [selectedFacilityVerticalIdProvider];
/// "Todas as linhas" clears the filter (API union). Hidden for 0–1 verticals.
///
/// When [allowedVerticalIds] is set, options are intersected with that set
/// (e.g. current clinic's verticals). Still requires 2+ options after filter.
class FacilityVerticalFilterBar extends ConsumerWidget {
  const FacilityVerticalFilterBar({
    super.key,
    this.padding = const EdgeInsets.fromLTRB(16, 0, 16, 8),
    this.onChanged,
    this.allowedVerticalIds,
  });

  final EdgeInsetsGeometry padding;
  final ValueChanged<String?>? onChanged;

  /// If non-null, only these vertical ids are offered (intersection with user).
  final Set<String>? allowedVerticalIds;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final optionsAsync = ref.watch(currentUserFacilityVerticalOptionsProvider);
    final selected = ref.watch(selectedFacilityVerticalIdProvider);

    return optionsAsync.maybeWhen(
      data: (options) {
        final filtered = _filterOptions(options, allowedVerticalIds);
        if (filtered.length < 2) return const SizedBox.shrink();

        final effectiveSelected =
            selected != null && filtered.any((v) => v.id == selected)
            ? selected
            : null;

        return Padding(
          padding: padding,
          child: VerticalSelector(
            verticals: filtered,
            selectedVerticalId: effectiveSelected,
            allowAll: true,
            onChanged: (verticalId) {
              ref.read(selectedFacilityVerticalIdProvider.notifier).state =
                  verticalId;
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
    Set<String>? allowed,
  ) {
    if (allowed == null) return options;
    if (allowed.isEmpty) return const [];
    return options.where((v) => allowed.contains(v.id)).toList(growable: false);
  }
}
