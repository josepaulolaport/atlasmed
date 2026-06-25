import 'package:flutter/material.dart';
import '../../data/models.dart';

class DoctorRow extends StatelessWidget {
  final Doctor doctor;
  final VoidCallback onTap;

  const DoctorRow({
    super.key,
    required this.doctor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hslBg = HSLColor.fromAHSL(1.0, doctor.hue, 0.48, 0.88);
    final hslText = HSLColor.fromAHSL(1.0, doctor.hue, 0.55, 0.32);

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
        ),
        child: Row(
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
                  ),
                  const SizedBox(height: 2),
                  Text(
                    doctor.specialty,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF1e40af),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          doctor.primaryClinic,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: Color(0xFF6b7280),
                          ),
                        ),
                      ),
                      const Text(' · ', style: TextStyle(fontSize: 11.5, color: Color(0xFF6b7280))),
                      Text(
                        doctor.crm,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF6b7280),
                        ),
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
}
