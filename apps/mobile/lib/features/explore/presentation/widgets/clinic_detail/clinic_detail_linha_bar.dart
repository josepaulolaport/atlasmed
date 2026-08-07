import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Height of [ClinicDetailLinhaBar] — keep in sync for sticky header extent.
const double kClinicDetailLinhaBarHeight = 84;

/// Linha comercial switcher for clinic detail (no "Todas").
///
/// Used as a pinned [SliverPersistentHeader] above Linha-scoped sections.
class ClinicDetailLinhaBar extends StatelessWidget {
  const ClinicDetailLinhaBar({
    super.key,
    required this.options,
    required this.selectedVerticalId,
    required this.onChanged,
    this.elevated = false,
  });

  final List<BusinessVertical> options;
  final int selectedVerticalId;
  final ValueChanged<int> onChanged;

  /// Slight shadow when the bar is pinned to the top while scrolling.
  final bool elevated;

  @override
  Widget build(BuildContext context) {
    if (options.length < 2) return const SizedBox.shrink();

    return Material(
      color: Colors.white,
      elevation: elevated ? 2 : 0,
      shadowColor: Colors.black26,
      child: Container(
        width: double.infinity,
        height: kClinicDetailLinhaBarHeight,
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.gray100)),
        ),
        alignment: Alignment.centerLeft,
        child: VerticalSelector(
          verticals: options,
          selectedVerticalId: selectedVerticalId,
          allowAll: false,
          label: 'Linha comercial',
          onChanged: (id) {
            if (id != null) onChanged(id);
          },
        ),
      ),
    );
  }
}

/// Pinned sticky wrapper for [ClinicDetailLinhaBar].
class ClinicDetailLinhaHeaderDelegate extends SliverPersistentHeaderDelegate {
  ClinicDetailLinhaHeaderDelegate({
    required this.options,
    required this.selectedVerticalId,
    required this.onChanged,
  });

  final List<BusinessVertical> options;
  final int selectedVerticalId;
  final ValueChanged<int> onChanged;

  @override
  double get minExtent => options.length < 2 ? 0 : kClinicDetailLinhaBarHeight;

  @override
  double get maxExtent => options.length < 2 ? 0 : kClinicDetailLinhaBarHeight;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return ClinicDetailLinhaBar(
      options: options,
      selectedVerticalId: selectedVerticalId,
      onChanged: onChanged,
      elevated: overlapsContent || shrinkOffset > 0,
    );
  }

  @override
  bool shouldRebuild(covariant ClinicDetailLinhaHeaderDelegate oldDelegate) {
    return oldDelegate.selectedVerticalId != selectedVerticalId ||
        oldDelegate.options.length != options.length ||
        !identical(oldDelegate.onChanged, onChanged);
  }
}
