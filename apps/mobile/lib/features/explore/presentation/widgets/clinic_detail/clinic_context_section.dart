import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class ClinicContextSection extends StatelessWidget {
  const ClinicContextSection({
    super.key,
    this.consultantName,
    this.consultantSince,
    this.managerName,
    this.managerSince,
    this.regionZoneLabel,
    this.city,
  });

  final String? consultantName;
  final DateTime? consultantSince;
  final String? managerName;
  final DateTime? managerSince;
  final String? regionZoneLabel;
  final String? city;

  @override
  Widget build(BuildContext context) {
    return ClinicDetailCard(
      child: Column(
        children: [
          _PersonRow(
            name: consultantName,
            roleLabel: consultantSince != null
                ? 'consultor responsável · desde ${_formatMonthYear(consultantSince!)}'
                : 'consultor responsável',
          ),
          if (managerName != null && managerName!.trim().isNotEmpty) ...[
            const SizedBox(height: 14),
            _PersonRow(
              name: managerName,
              roleLabel: managerSince != null
                  ? 'gerente responsável · desde ${_formatMonthYear(managerSince!)}'
                  : 'gerente responsável',
              avatarColor: const Color(0xFFecfdf5),
              initialsColor: const AppColors.green600,
            ),
          ],
          const Divider(height: 20, color: AppColors.gray100),
          if (regionZoneLabel != null)
            _ContextRow(
              icon: Icons.explore_outlined,
              label: 'Região',
              value: [
                if (city != null && city!.isNotEmpty) city,
                regionZoneLabel,
              ].join(' · '),
            )
          else if (city != null && city!.isNotEmpty)
            _ContextRow(
              icon: Icons.location_city_outlined,
              label: 'Cidade',
              value: city!,
            ),
        ],
      ),
    );
  }

  String _formatMonthYear(DateTime d) {
    const months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    return '${months[d.month - 1]}/${d.year}';
  }
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({
    required this.name,
    required this.roleLabel,
    this.avatarColor = const Color(0xFFeef4ff),
    this.initialsColor = const AppColors.navyBright,
  });

  final String? name;
  final String roleLabel;
  final Color avatarColor;
  final Color initialsColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 18,
          backgroundColor: avatarColor,
          child: Text(
            _initials(name),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: initialsColor,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name?.trim().isNotEmpty == true ? name!.trim() : '—',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray900,
                ),
              ),
              Text(
                roleLabel,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.gray400,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return '?';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }
}

class _ContextRow extends StatelessWidget {
  const _ContextRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const AppColors.gray400),
          const SizedBox(width: 10),
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: AppColors.gray500),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.gray900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
