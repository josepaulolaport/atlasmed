import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

enum DoctorClinicAction { editRoles, viewProfile }

/// Small chooser: define clinic role vs open full doctor profile.
Future<DoctorClinicAction?> showDoctorClinicActionsSheet(
  BuildContext context, {
  required String doctorName,
}) {
  return showModalBottomSheet<DoctorClinicAction>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (sheetContext) {
      final bottom = MediaQuery.of(sheetContext).padding.bottom;
      return SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 10, 16, 12 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.gray300,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                doctorName,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              const Text(
                'O que deseja fazer?',
                style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
              ),
              const SizedBox(height: 12),
              _ActionTile(
                icon: Icons.badge_outlined,
                label: 'Definir papel na clínica',
                onTap: () => Navigator.of(
                  sheetContext,
                ).pop(DoctorClinicAction.editRoles),
              ),
              const SizedBox(height: 8),
              _ActionTile(
                icon: Icons.person_outline_rounded,
                label: 'Ver perfil completo',
                onTap: () => Navigator.of(
                  sheetContext,
                ).pop(DoctorClinicAction.viewProfile),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surfaceTertiary,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 22, color: AppColors.navyBright),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gray900,
                  ),
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.gray400,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
