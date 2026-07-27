import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_doctor_roles_sheet.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

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

  final List<FacilityCrmDoctor> doctors;
  final String? facilityId;
  final bool hasMore;
  final bool isLoadingMore;
  final VoidCallback? onLoadMore;
  final VoidCallback? onAssociate;
  final ValueChanged<FacilityCrmDoctor>? onDoctorUpdated;

  @override
  Widget build(BuildContext context) {
    if (doctors.isEmpty && !hasMore) {
      return ClinicDetailCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Column(
            children: [
              const Text(
                'Nenhum médico associado a este estabelecimento',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.gray400),
              ),
              if (onAssociate != null) ...[
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: onAssociate,
                  icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                  label: const Text('Associar médicos'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.navyBright,
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    if (doctors.isNotEmpty) {
      return ClinicDetailCard(
        child: Column(
          children: [
            for (final (i, doctor) in doctors.indexed) ...[
              if (i > 0) const Divider(height: 1, color: Color(0xFFf3f4f6)),
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

  final FacilityCrmDoctor doctor;
  final String? facilityId;
  final bool canEditRoles;
  final ValueChanged<FacilityCrmDoctor>? onDoctorUpdated;

  @override
  Widget build(BuildContext context) {
    final badges = _badges;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      child: InkWell(
        onTap: () {
          final id = facilityId;
          final uri = id == null || id.isEmpty
              ? '/explore/doctor/${doctor.id}'
              : '/explore/doctor/${doctor.id}?facilityId=$id';
          context.push(uri);
        },
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: HSLColor.fromAHSL(
                1,
                doctor.hue,
                0.48,
                0.88,
              ).toColor(),
              child: Text(
                doctor.initials,
                style: TextStyle(
                  fontSize: 11,
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
                      fontSize: 13.5,
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
                        fontSize: 11.5,
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
                        fontSize: 11,
                        color: AppColors.gray400,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            if (canEditRoles)
              InkWell(
                onTap: () => _editRoles(context),
                borderRadius: BorderRadius.circular(8),
                child: badges.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 2),
                        child: Text(
                          'Definir papel',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.navyBright,
                          ),
                        ),
                      )
                    : Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          ...badges,
                          const Icon(
                            Icons.edit_outlined,
                            size: 14,
                            color: AppColors.navyBright,
                          ),
                        ],
                      ),
              )
            else if (badges.isNotEmpty)
              Wrap(
                spacing: 6,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: badges,
              ),
          ],
        ),
      ),
    );
  }

  List<Widget> get _badges {
    final badges = <Widget>[];
    if (doctor.roleBadge != null) {
      badges.add(_RoleBadge(label: doctor.roleBadge!));
    }
    if (doctor.isPrescriber) badges.add(const _Flag(label: 'Prescritor'));
    if (doctor.isBuyer) badges.add(const _Flag(label: 'Comprador'));
    if (doctor.isDecisionMaker && doctor.roleBadge == null) {
      badges.add(const _Flag(label: 'Decisor'));
    }
    if (doctor.isPartner) badges.add(const _Flag(label: 'Sócio'));
    return badges;
  }

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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.blueLight,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: AppColors.navyBright,
        ),
      ),
    );
  }
}

class _RoleBadge extends StatelessWidget {
  const _RoleBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final isNew = label.toUpperCase() == 'NOVA';
    final color = isNew ? AppColors.green : AppColors.purple;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
