import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/cnes_facility_import_screen.dart';

/// The way into the CNES import (spec 0015 §6.0).
///
/// Appears in two places: the Clínicas tab, and the no-results state of a clinic
/// search — which is the exact moment §6 describes, *the user searches and does
/// not find the clinic*.
///
/// It says **search CNES**, deliberately. Importing is now the only way a clinic
/// comes into existence (§6.5), so a generic "+" would promise hand-typing, an
/// action that no longer exists.
///
/// Hidden for roles that may not import. The API enforces the same rule
/// independently — this only avoids offering a button that would answer 403.
class CnesImportEntryButton extends ConsumerWidget {
  const CnesImportEntryButton({super.key, this.initialQuery = ''});

  /// Prefills the CNES search with whatever the user was already looking for.
  final String initialQuery;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(canImportFacilityFromCnesProvider)) {
      return const SizedBox.shrink();
    }

    return OutlinedButton.icon(
      key: const ValueKey('cnes-import-entry'),
      icon: const Icon(Icons.travel_explore, size: 18),
      label: const Text('Buscar no CNES'),
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => CnesFacilityImportScreen(initialQuery: initialQuery),
        ),
      ),
    );
  }
}
