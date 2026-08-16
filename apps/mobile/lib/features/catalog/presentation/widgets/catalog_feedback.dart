import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// The panel's snackbars.
///
/// Floating, matching Explorar — the largest surface in the app and the one
/// this panel's lists were modelled on. It also keeps the toast clear of the
/// extended FAB every list screen carries.
///
/// [isError] is the only variant. A failure that looks exactly like a success
/// is how an admin walks away from an edit that did not happen.
///
/// [action] offers a way back from the edit that was just made — an undo, in
/// practice. It buys the toast a longer life, because a button nobody has time
/// to reach for is the same as no button.
void showCatalogSnack(
  BuildContext context,
  String message, {
  bool isError = false,
  SnackBarAction? action,
}) {
  ScaffoldMessenger.of(context)
    // Editing several rows in a row otherwise queues toasts that land long
    // after the work they describe.
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isError ? AppColors.error : AppColors.gray900,
        duration: Duration(
          seconds: isError
              ? 5
              : action == null
              ? 3
              : 7,
        ),
        action: action,
        content: Row(
          children: [
            Icon(
              isError
                  ? Icons.error_outline_rounded
                  : Icons.check_circle_outline_rounded,
              size: 18,
              color: Colors.white,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(message, style: const TextStyle(fontSize: 13)),
            ),
          ],
        ),
      ),
    );
}

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
/// [action] rides along for the unlink case, where the notice and a way back
/// are both wanted and only one snackbar can be on screen at a time.
void showNightlyRecomputeNotice(
  BuildContext context, {
  String? prefix,
  SnackBarAction? action,
}) {
  final message = prefix == null
      ? 'Os números das clínicas são atualizados no próximo processamento '
            'noturno.'
      : '$prefix Os números das clínicas são atualizados no próximo '
            'processamento noturno.';
  showCatalogSnack(context, message, action: action);
}
