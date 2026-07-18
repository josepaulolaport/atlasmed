import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';

class ClinicContextSection extends StatelessWidget {
  const ClinicContextSection({
    super.key,
    this.consultantName,
    this.consultantSince,
    this.regionZoneLabel,
    this.city,
  });

  final String? consultantName;
  final DateTime? consultantSince;
  final String? regionZoneLabel;
  final String? city;

  @override
  Widget build(BuildContext context) {
    return ClinicDetailCard(
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: const Color(0xFFeef4ff),
                child: Text(
                  _initials(consultantName),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1e40af),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      consultantName ?? '—',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0f1729),
                      ),
                    ),
                    Text(
                      consultantSince != null
                          ? 'consultor responsável · desde ${_formatMonthYear(consultantSince!)}'
                          : 'consultor responsável',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF9ca3af),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 20, color: Color(0xFFf3f4f6)),
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

  String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return '?';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
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
          Icon(icon, size: 16, color: const Color(0xFF9ca3af)),
          const SizedBox(width: 10),
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF0f1729),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
