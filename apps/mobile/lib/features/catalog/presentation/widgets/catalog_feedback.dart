import 'package:flutter/material.dart';

/// What the panel says after a link or an unlink (spec 0016 §6.6).
///
/// The panel never triggers a recompute. Spec 0013 §4.6 backlogs the
/// catalogue-change fan-out explicitly: linking, unlinking or editing a product
/// changes the answer for every clinic holding orders or usage for it, recompute
/// is per-profile, and there is no fan-out. Those clinics are corrected by the
/// nightly pass.
///
/// Saying so is the difference between "it worked" and an admin who sees an
/// unchanged number, concludes the edit failed, and does it again. One function
/// rather than the string repeated at four call sites, so the four cannot start
/// promising slightly different things.
void showNightlyRecomputeNotice(BuildContext context, {String? prefix}) {
  final message = prefix == null
      ? 'Os números das clínicas são atualizados no próximo processamento '
            'noturno.'
      : '$prefix Os números das clínicas são atualizados no próximo '
            'processamento noturno.';
  ScaffoldMessenger.of(context)
    // The admin can link several competitors in a row; queuing four identical
    // snackbars behind each other means the last one lands long after the work.
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}
