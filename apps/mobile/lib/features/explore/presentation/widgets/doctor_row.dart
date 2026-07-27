import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/relationship_stars.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class DoctorRow extends StatelessWidget {
  final ProfessionalEntry doctor;
  final VoidCallback onTap;

  /// When false, hides the trailing "X.X km" (e.g. facility-scoped lists
  /// where every doctor is at the same establishment).
  final bool showDistance;

  /// Optional facility-list extras (Explorar rows leave these null).
  final String? phone;
  final int? relationshipScore;
  final bool showRelationship;

  /// Role chips shown beside specialty (e.g. Decisor, Comprador, Prescritor).
  final List<String> badges;

  /// Facility-roster action to edit association role flags without opening
  /// the full doctor profile.
  final VoidCallback? onEditRoles;

  const DoctorRow({
    super.key,
    required this.doctor,
    required this.onTap,
    this.showDistance = true,
    this.phone,
    this.relationshipScore,
    this.showRelationship = false,
    this.badges = const [],
    this.onEditRoles,
  });

  @override
  Widget build(BuildContext context) {
    final hslBg = HSLColor.fromAHSL(1.0, doctor.hue, 0.48, 0.88);
    final hslText = HSLColor.fromAHSL(1.0, doctor.hue, 0.55, 0.32);
    final clinic = doctor.displayFacilityName?.trim() ?? '';
    final crm = doctor.crm ?? '';
    final meta = [
      if (clinic.isNotEmpty) clinic,
      if (crm.isNotEmpty) crm,
    ].join(' · ');
    final phoneLabel = phone?.trim();
    final hasPhone = phoneLabel != null && phoneLabel.isNotEmpty;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: hslBg.toColor(),
                  ),
                  child: Center(
                    child: Text(
                      doctor.initials,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: hslText.toColor(),
                      ),
                    ),
                  ),
                ),
                if (doctor.isPriority)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      key: const Key('doctor-priority-indicator'),
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: AppColors.rose,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doctor.name,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  if ((doctor.specialty ?? '').trim().isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      doctor.specialty ?? '',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                        color: AppColors.navyBright,
                      ),
                    ),
                  ],
                  if (badges.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        for (final label in badges) _RowBadge(label: label),
                      ],
                    ),
                  ],
                  if (meta.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      meta,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray500,
                      ),
                    ),
                  ],
                  if (showDistance && doctor.distanceKm != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      '${doctor.distanceKm!.toStringAsFixed(1)} km',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: AppColors.gray500,
                      ),
                    ),
                  ],
                  if (showRelationship || phone != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(
                          Icons.phone_outlined,
                          size: 13,
                          color: hasPhone
                              ? AppColors.gray500
                              : AppColors.gray300,
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Text(
                            hasPhone ? phoneLabel : 'Sem telefone',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: hasPhone
                                  ? AppColors.gray600
                                  : AppColors.gray400,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (showRelationship) ...[
                    const SizedBox(height: 5),
                    RelationshipStars(score: relationshipScore),
                  ],
                ],
              ),
            ),
            if (onEditRoles != null) ...[
              const SizedBox(width: 4),
              IconButton(
                onPressed: onEditRoles,
                tooltip: 'Editar papel',
                visualDensity: VisualDensity.compact,
                icon: const Icon(
                  Icons.edit_outlined,
                  size: 20,
                  color: AppColors.navyBright,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RowBadge extends StatelessWidget {
  const _RowBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final emphasized = label.toUpperCase().contains('DECISOR');
    final color = emphasized ? AppColors.purple : AppColors.navyBright;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
