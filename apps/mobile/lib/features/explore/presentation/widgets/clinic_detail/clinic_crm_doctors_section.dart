import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_doctor_roles_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/facility_roster_page_view.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/relationship_stars.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// "Médicos" — snapping PageView of compact cards, each focused on
/// essential contact info (phone/email) plus a dedicated badges area. The
/// "Ver todos" link to the full doctor list lives on the section header.
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
  final String? facilityId;

  /// When true, [onLoadMore] is called as the user reaches the loaded cards.
  final bool hasMore;

  /// Shows the trailing shimmer only for an active next-page request.
  final bool isLoadingMore;
  final VoidCallback? onLoadMore;

  /// Opens the full list / associate flow when the roster is empty.
  final VoidCallback? onAssociate;

  /// Called after facility-scoped role flags are saved for a doctor.
  final ValueChanged<ProfessionalRoster>? onDoctorUpdated;

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

    return FacilityRosterPageView(
      height: 268,
      itemCount: doctors.length,
      hasMore: hasMore,
      isLoadingMore: isLoadingMore,
      onLoadMore: onLoadMore,
      itemBuilder: (_, i) => _DoctorCard(
        doctor: doctors[i],
        facilityId: facilityId,
        canEditRoles: onDoctorUpdated != null,
        onDoctorUpdated: onDoctorUpdated,
      ),
    );
  }
}

class _DoctorCard extends StatelessWidget {
  const _DoctorCard({
    required this.doctor,
    this.facilityId,
    this.canEditRoles = false,
    this.onDoctorUpdated,
  });

  final ProfessionalRoster doctor;
  final String? facilityId;
  final bool canEditRoles;
  final ValueChanged<ProfessionalRoster>? onDoctorUpdated;

  @override
  Widget build(BuildContext context) {
    final badges = _badges;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: HSLColor.fromAHSL(1, doctor.hue, 0.2, 0.9).toColor(),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    doctor.initials,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: HSLColor.fromAHSL(
                        1,
                        doctor.hue,
                        0.6,
                        0.35,
                      ).toColor(),
                    ),
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
            ],
          ),
          const SizedBox(height: 8),
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
          const SizedBox(height: 10),
          const Divider(height: 1, color: AppColors.gray100),
          const SizedBox(height: 8),
          _ContactRow(
            icon: Icons.phone_outlined,
            value: doctor.phone,
            onTap: doctor.phone != null
                ? () => launchContactUrl(
                    context,
                    url: callUrl(doctor.phone),
                    contactLabel: 'telefone',
                  )
                : null,
          ),
          const SizedBox(height: 6),
          _ContactRow(
            icon: Icons.email_outlined,
            value: doctor.email,
            onTap: doctor.email != null
                ? () => launchContactUrl(
                    context,
                    url: emailUrl(doctor.email),
                    contactLabel: 'e-mail',
                  )
                : null,
          ),
          const SizedBox(height: 8),
          RelationshipStars(score: doctor.relationshipScore),
          Expanded(
            child: Column(
              children: [
                const Spacer(),
                const Divider(height: 1, color: AppColors.gray100),
                const SizedBox(height: 8),
                InkWell(
                  onTap: () {
                    final id = facilityId;
                    final uri = id == null || id.isEmpty
                        ? '/explore/doctor/${doctor.id}'
                        : '/explore/doctor/${doctor.id}?facilityId=$id';
                    context.push(uri);
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Text(
                          'Ver perfil completo',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.navyBright,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 16,
                          color: AppColors.navyBright,
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(),
              ],
            ),
          ),
        ],
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

class _ContactRow extends StatelessWidget {
  const _ContactRow({required this.icon, required this.value, this.onTap});

  final IconData icon;
  final String? value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Row(
        children: [
          Icon(
            icon,
            size: 15,
            color: value != null ? AppColors.navyBright : AppColors.gray300,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value ?? 'Não informado',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: value != null ? FontWeight.w500 : FontWeight.w400,
                color: value != null ? AppColors.gray900 : AppColors.gray400,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
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
