import 'package:flutter/material.dart';
import '../../data/models.dart';
import 'status_chip.dart';

class ClinicRow extends StatelessWidget {
  final Clinic clinic;
  final VoidCallback onTap;

  const ClinicRow({
    super.key,
    required this.clinic,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
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
                    borderRadius: BorderRadius.circular(12),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFFdbeafe), Color(0xFFeef4ff)],
                    ),
                  ),
                  child: const Icon(Icons.local_hospital_rounded, size: 22, color: Color(0xFF1e40af)),
                ),
                if (clinic.isPriority)
                  Positioned(
                    top: -3,
                    right: -3,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: const Color(0xFFe11d48),
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
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Flexible(
                        child: Text(
                          clinic.name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0f1729),
                            letterSpacing: -0.15,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${clinic.distanceKm.toStringAsFixed(1)} km',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF6b7280),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Icon(Icons.location_on_rounded, size: 11, color: const Color(0xFF6b7280)),
                      const SizedBox(width: 2),
                      Expanded(
                        child: Text(
                          _locationLine(clinic),
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF6b7280),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      StatusChip(
                        label: clinic.status.label,
                        color: clinic.status.color,
                        bg: clinic.status.bg,
                        small: true,
                      ),
                      if (clinic.lastVisitDays != null)
                        _MetaItem(
                          icon: Icons.access_time_rounded,
                          text: clinic.lastVisitDays == 0
                              ? 'Hoje'
                              : 'Há ${clinic.lastVisitDays} dia${clinic.lastVisitDays! > 1 ? 's' : ''}',
                        ),
                      _MetaItem(
                        icon: Icons.person_outline_rounded,
                        text: '${clinic.doctorCount} ${clinic.doctorCount == 1 ? 'médico' : 'médicos'}',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _locationLine(Clinic clinic) {
    final parts = <String>[];
    if (clinic.neighborhood.trim().isNotEmpty && clinic.neighborhood != '—') {
      parts.add(clinic.neighborhood);
    }
    if (clinic.city.trim().isNotEmpty && clinic.city != '—') {
      parts.add(clinic.city);
    }
    if (clinic.stateCode != null && clinic.stateCode!.trim().isNotEmpty) {
      parts.add(clinic.stateCode!);
    }
    return parts.isEmpty ? '—' : parts.join(' · ');
  }
}

class _MetaItem extends StatelessWidget {
  final IconData icon;
  final String text;

  const _MetaItem({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: const Color(0xFF6b7280)),
        const SizedBox(width: 4),
        Text(
          text,
          style: const TextStyle(fontSize: 11.5, color: Color(0xFF6b7280)),
        ),
      ],
    );
  }
}
