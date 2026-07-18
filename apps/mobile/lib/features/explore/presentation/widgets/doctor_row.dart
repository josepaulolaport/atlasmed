import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/doctor.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/relationship_stars.dart';

class DoctorRow extends StatelessWidget {
  final Doctor doctor;
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

  const DoctorRow({
    super.key,
    required this.doctor,
    required this.onTap,
    this.showDistance = true,
    this.phone,
    this.relationshipScore,
    this.showRelationship = false,
    this.badges = const [],
  });

  @override
  Widget build(BuildContext context) {
    final hslBg = HSLColor.fromAHSL(1.0, doctor.hue, 0.48, 0.88);
    final hslText = HSLColor.fromAHSL(1.0, doctor.hue, 0.55, 0.32);
    final clinic = doctor.primaryClinic.trim();
    final crm = doctor.crm.trim();
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
                      width: 12,
                      height: 12,
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
                          doctor.name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0f1729),
                            letterSpacing: -0.15,
                          ),
                        ),
                      ),
                      if (showDistance) ...[
                        const SizedBox(width: 8),
                        Text(
                          '${doctor.distanceKm.toStringAsFixed(1)} km',
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF6b7280),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (doctor.specialty.trim().isNotEmpty ||
                      badges.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        if (doctor.specialty.trim().isNotEmpty)
                          Text(
                            doctor.specialty,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF1e40af),
                            ),
                          ),
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
                        color: Color(0xFF6b7280),
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
                              ? const Color(0xFF6b7280)
                              : const Color(0xFFc4c9d2),
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
                                  ? const Color(0xFF4b5563)
                                  : const Color(0xFF9ca3af),
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
    final color = emphasized
        ? const Color(0xFF7c3aed)
        : const Color(0xFF1e40af);
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
