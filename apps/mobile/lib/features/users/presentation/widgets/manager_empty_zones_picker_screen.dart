import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_picker_screen.dart';
import 'package:flutter/material.dart';

/// MANAGER invite — pick one or more empty zones in a vertical.
class ManagerEmptyZonesPickerScreen {
  ManagerEmptyZonesPickerScreen._();

  static Future<List<TerritoryOption>?> pick(
    BuildContext context, {
    required String verticalId,
    Set<String> initiallySelectedIds = const {},
  }) {
    return TerritoryPickerScreen.pickManagerEmptyZones(
      context,
      verticalId: verticalId,
      initiallySelectedIds: initiallySelectedIds,
    );
  }
}
