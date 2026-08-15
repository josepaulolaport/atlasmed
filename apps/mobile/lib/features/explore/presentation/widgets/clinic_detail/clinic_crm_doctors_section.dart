import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_doctor_roles_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

/// "Médicos" — compact vertical list. The "Ver todos" link to the full
/// doctor list lives on the section header.
class ClinicCrmDoctorsSection extends StatelessWidget {
  const ClinicCrmDoctorsSection({
    super.key,
    required this.doctors,
    this.facilityId,
    this.hasMore = false,
    this.isLoadingMore = false,
    this.onLoadMore,
    this.onAssociate,
    this.onDoctorUpdated,
  });

  final List<ProfessionalRoster> doctors;
  final int? facilityId;

  final bool hasMore;
  final bool isLoadingMore;
  final VoidCallback? onLoadMore;

  /// Opens the full list / associate flow when the roster is empty.
  final VoidCallback? onAssociate;

  /// Called after facility-scoped role flags are saved from a row.
  final ValueChanged<ProfessionalRoster>? onDoctorUpdated;

  @override
  Widget build(BuildContext context) {
    if (doctors.isEmpty && !hasMore) {
      return ClinicaEmptySection(
        icon: Icons.medical_services_outlined,
        title: 'Nenhum médico associado',
        description: 'Associe médicos que atuam neste estabelecimento.',
        onAction: onAssociate,
        actionLabel: const Text('Associar médicos'),
        actionIcon: Icons.person_add_alt_1_rounded,
      );
    }

    if (doctors.isNotEmpty) {
      return ClinicDetailCard(
        child: Column(
          children: [
            for (final (i, doctor) in doctors.indexed) ...[
              if (i > 0) const Divider(height: 1, color: AppColors.gray100),
              _DoctorRow(
                doctor: doctor,
                facilityId: facilityId,
                canEditRoles: onDoctorUpdated != null,
                onDoctorUpdated: onDoctorUpdated,
              ),
            ],
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}

class _DoctorRow extends StatelessWidget {
  const _DoctorRow({
    required this.doctor,
    this.facilityId,
    this.canEditRoles = false,
    this.onDoctorUpdated,
  });

  final ProfessionalRoster doctor;
  final int? facilityId;
  final bool canEditRoles;
  final ValueChanged<ProfessionalRoster>? onDoctorUpdated;

  @override
  Widget build(BuildContext context) {
    final badges = _badges;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: InkWell(
        onTap: () => DoctorDetailRoute(
          id: doctor.id,
          facilityId: facilityId != null && facilityId! > 0 ? facilityId : null,
        ).push(context),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: HSLColor.fromAHSL(
                1,
                doctor.hue,
                0.48,
                0.88,
              ).toColor(),
              child: Text(
                doctor.initials,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: HSLColor.fromAHSL(1, doctor.hue, 0.55, 0.32).toColor(),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doctor.name,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.25,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray900,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (doctor.specialty != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      doctor.specialty!,
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.25,
                        color: AppColors.gray500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (doctor.crm != null) ...[
                    const SizedBox(height: 1),
                    Text(
                      doctor.crm!,
                      style: const TextStyle(
                        fontSize: 12.5,
                        height: 1.25,
                        color: AppColors.gray500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  /*
                   * Roles wrap under the name, across the full width.
                   *
                   * They used to sit in a trailing column capped at 140px, so a
                   * doctor with four of them — Prescritor, Comprador, Decisor,
                   * Administrador — got one chip per line, four lines tall, and
                   * the column beside it shrank until the name ellipsised to
                   * "Leonardo De Oliv…". The chips are about this person, so
                   * they belong under their name rather than in a gutter that
                   * competes with it for room.
                   */
                  if (badges.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Wrap(spacing: 6, runSpacing: 6, children: badges),
                  ] else if (canEditRoles) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Definir papel',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.navyBright,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // The pencil keeps its own 44px target, and nothing else, so the
            // name column gets the rest of the row.
            if (canEditRoles)
              InkWell(
                onTap: () => _editRoles(context),
                borderRadius: BorderRadius.circular(8),
                child: const SizedBox(
                  width: 44,
                  height: 44,
                  child: Icon(
                    Icons.edit_outlined,
                    size: 16,
                    color: AppColors.navyBright,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> get _badges => [
    for (final label in doctor.roleChipLabels) _Flag(label: label),
  ];

  Future<void> _editRoles(BuildContext context) async {
    final updated = await showEditDoctorRolesSheet(
      context,
      doctor: doctor,
      facilityId: facilityId,
    );
    if (updated == null) return;
    onDoctorUpdated?.call(updated);
  }
}

class _Flag extends StatelessWidget {
  const _Flag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.blueLight,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: AppColors.navyBright,
        ),
      ),
    );
  }
}
