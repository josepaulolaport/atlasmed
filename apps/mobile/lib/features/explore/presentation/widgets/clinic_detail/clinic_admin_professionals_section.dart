import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/representative_detail_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// "Profissionais administrativos" — compact vertical list. The "Ver todos"
/// link to the full list lives on the section header.
class ClinicAdminProfessionalsSection extends StatelessWidget {
  const ClinicAdminProfessionalsSection({
    super.key,
    required this.professionals,
    required this.facilityName,
    this.facilityId,
    this.hasMore = false,
    this.isLoadingMore = false,
    this.onLoadMore,
    this.onAssociate,
  });

  final List<AdministrativeProfessional> professionals;
  final String facilityName;
  final int? facilityId;

  /// When true, [onLoadMore] is called as the user reaches the loaded cards.
  final bool hasMore;

  /// Shows the trailing shimmer only for an active next-page request.
  final bool isLoadingMore;
  final VoidCallback? onLoadMore;

  /// Opens the full list / associate flow when the roster is empty.
  final VoidCallback? onAssociate;

  @override
  Widget build(BuildContext context) {
    if (professionals.isEmpty && !hasMore) {
      return ClinicaEmptySection(
        icon: Icons.badge_outlined,
        title: 'Nenhum contato administrativo cadastrado',
        description: 'Adicione contatos da clínica para gestão e comunicação.',
        onAction: onAssociate,
        actionLabel: const Text('Criar profissional'),
        actionIcon: Icons.person_add_alt_1_rounded,
      );
    }

    if (professionals.isNotEmpty) {
      return ClinicDetailCard(
        child: Column(
          children: [
            for (final (i, professional) in professionals.indexed) ...[
              if (i > 0) const Divider(height: 1, color: AppColors.gray100),
              _ProfessionalRow(
                professional: professional,
                facilityName: facilityName,
                facilityId: facilityId,
              ),
            ],
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}

class _ProfessionalRow extends StatelessWidget {
  const _ProfessionalRow({
    required this.professional,
    required this.facilityName,
    this.facilityId,
  });

  final AdministrativeProfessional professional;
  final String facilityName;
  final int? facilityId;

  @override
  Widget build(BuildContext context) {
    final badges = professional.roleChipLabels;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => RepresentativeDetailScreen(
              professional: professional,
              facilityName: facilityName,
              facilityId: facilityId,
            ),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.blueLight,
              child: Text(
                _initials(professional.name),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyBright,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    professional.name,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray900,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (professional.roleTitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      professional.roleTitle!,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            if (badges.isNotEmpty)
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [for (final label in badges) _Flag(label: label)],
              ),
          ],
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
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
