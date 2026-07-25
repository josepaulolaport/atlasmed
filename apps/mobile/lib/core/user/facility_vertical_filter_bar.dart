import 'package:atlasmed_mobile_app/core/user/vertical_scope_provider.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shows a vertical chip row when the signed-in user has 2+ business verticals.
///
/// Selecting a chip updates [selectedFacilityVerticalIdProvider]; "Todas"
/// clears the filter (API union). Hidden for 0–1 verticals.
class FacilityVerticalFilterBar extends ConsumerWidget {
  const FacilityVerticalFilterBar({
    super.key,
    this.padding = const EdgeInsets.fromLTRB(16, 0, 16, 8),
    this.onChanged,
  });

  final EdgeInsetsGeometry padding;
  final ValueChanged<String?>? onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final optionsAsync = ref.watch(currentUserFacilityVerticalOptionsProvider);
    final selected = ref.watch(selectedFacilityVerticalIdProvider);

    return optionsAsync.maybeWhen(
      data: (options) {
        if (options.length < 2) return const SizedBox.shrink();
        return Padding(
          padding: padding,
          child: VerticalSelector(
            verticals: options,
            selectedVerticalId: selected,
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
}
