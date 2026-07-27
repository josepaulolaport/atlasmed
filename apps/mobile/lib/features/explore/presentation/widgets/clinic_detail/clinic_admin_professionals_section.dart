import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/facility_roster_page_view.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/representative_detail_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// "Profissionais administrativos" — snapping PageView of compact cards
/// with contact info (phone/email) and role chips.
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
  final String? facilityId;

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
      return ClinicDetailCard(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Column(
            children: [
              const Text(
                'Nenhum contato administrativo cadastrado',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.gray400),
              ),
              if (onAssociate != null) ...[
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: onAssociate,
                  icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                  label: const Text('Criar profissional'),
                  style: TextButton.styleFrom(
                    foregroundColor: const AppColors.navyBright,
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }

    return FacilityRosterPageView(
      height: 220,
      itemCount: professionals.length,
      hasMore: hasMore,
      isLoadingMore: isLoadingMore,
      onLoadMore: onLoadMore,
      itemBuilder: (_, i) => _ProfessionalCard(
        professional: professionals[i],
        facilityName: facilityName,
        facilityId: facilityId,
      ),
    );
  }
}

class _ProfessionalCard extends StatelessWidget {
  const _ProfessionalCard({
    required this.professional,
    required this.facilityName,
    this.facilityId,
  });

  final AdministrativeProfessional professional;
  final String facilityName;
  final String? facilityId;

  @override
  Widget build(BuildContext context) {
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
                  color: const AppColors.blueLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    _initials(professional.name),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navyBright,
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
            ],
          ),
          if (professional.roleChipLabels.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final label in professional.roleChipLabels)
                  _Flag(label: label),
              ],
            ),
          ],
          const SizedBox(height: 10),
          const Divider(height: 1, color: AppColors.gray100),
          const SizedBox(height: 8),
          _ContactRow(
            icon: Icons.phone_outlined,
            value: professional.phone,
            onTap: professional.phone != null
                ? () => launchContactUrl(
                    context,
                    url: callUrl(professional.phone),
                    contactLabel: 'telefone',
                  )
                : null,
          ),
          const SizedBox(height: 6),
          _ContactRow(
            icon: Icons.email_outlined,
            value: professional.email,
            onTap: professional.email != null
                ? () => launchContactUrl(
                    context,
                    url: emailUrl(professional.email),
                    contactLabel: 'e-mail',
                  )
                : null,
          ),
          const Spacer(),
          const Divider(height: 1, color: AppColors.gray100),
          const SizedBox(height: 8),
          InkWell(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => RepresentativeDetailScreen(
                  professional: professional,
                  facilityName: facilityName,
                  facilityId: facilityId,
                ),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Ver perfil completo',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.navyBright,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 16,
                    color: AppColors.navyBright,
                  ),
                ],
              ),
            ),
          ),
        ],
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
            color: value != null
                ? const AppColors.navyBright
                : const AppColors.gray300,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value ?? 'Não informado',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: value != null ? FontWeight.w500 : FontWeight.w400,
                color: value != null
                    ? const AppColors.gray900
                    : const AppColors.gray400,
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
        color: const AppColors.blueLight,
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
