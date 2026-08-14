import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

/// Formats the running build identity as `v1.2.0+8`, or `v1.2.0+8 (3)` when a
/// Shorebird patch is applied (the parenthesized number is the patch number).
String formatAppVersion({
  required String version,
  required String buildNumber,
  int? patchNumber,
}) {
  final base = 'v$version+$buildNumber';
  return patchNumber == null ? base : '$base ($patchNumber)';
}

/// Resolves the version string displayed in footers (login, drawer, profile).
///
/// Reads the binary's real version/build number via `package_info_plus` and
/// appends the Shorebird patch number when one is installed. The patch read
/// degrades gracefully: when the Shorebird engine is unavailable it returns
/// null by design, and a failed read is logged instead of hiding the version.
final appVersionProvider = FutureProvider<String>((ref) async {
  final info = await PackageInfo.fromPlatform();

  int? patchNumber;
  try {
    patchNumber = (await ShorebirdUpdater().readCurrentPatch())?.number;
  } on ReadPatchException catch (error) {
    // A failed patch read must not hide the release version. Log it so the
    // degradation stays visible instead of silently showing "no patch".
    debugPrint('appVersionProvider: failed to read Shorebird patch: $error');
  }

  return formatAppVersion(
    version: info.version,
    buildNumber: info.buildNumber,
    patchNumber: patchNumber,
  );
});
