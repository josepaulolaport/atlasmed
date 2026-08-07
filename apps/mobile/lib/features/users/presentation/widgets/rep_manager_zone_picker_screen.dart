import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_picker_screen.dart';
import 'package:flutter/material.dart';

/// REP invite — pick the parent manager zone (single select, occupied OK).
class RepManagerZonePickerScreen {
  RepManagerZonePickerScreen._();

  static Future<TerritoryOption?> pick(
    BuildContext context, {
    required int verticalId,
    int? initiallySelectedId,
  }) {
    return TerritoryPickerScreen.pickRepParentZone(
      context,
      verticalId: verticalId,
      initiallySelectedId: initiallySelectedId,
    );
  }
}
