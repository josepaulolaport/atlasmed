import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/user_assignments.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Opens the full-screen per-sector assignment editor (invite-shaped UX).
///
/// Kept as a thin entry point so existing call sites on the user detail
/// screen keep working without a modal sheet.
class ManageAssignmentsSheet {
  const ManageAssignmentsSheet._();

  static Future<void> show(
    BuildContext context, {
    required User user,
    required UserAssignments assignments,
  }) {
    return context.push<void>('/users/${user.id}/assignments');
  }
}
