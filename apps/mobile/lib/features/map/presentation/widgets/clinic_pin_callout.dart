import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:flutter/material.dart';

/// Pin callout / info-window content. Rendered off-screen, rasterized, and
/// attached to the map as a `PointAnnotation` so it tracks the pin natively.
class ClinicPinCalloutContent extends StatelessWidget {
  const ClinicPinCalloutContent({super.key, required this.establishment});

  final NearbyEstablishment establishment;

  static const double cardWidth = 216;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: cardWidth,
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: const [
              BoxShadow(
                color: Color(0x40111827),
                blurRadius: 18,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                establishment.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 3,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: establishment.status.color,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        establishment.status.label,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: establishment.status.color,
                        ),
                      ),
                    ],
                  ),
                  if (establishment.specialtyLabel != null)
                    Text(
                      '· ${establishment.specialtyLabel}',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.near_me_rounded,
                    size: 12,
                    color: Color(0xFF6b7280),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${establishment.distanceKm.toStringAsFixed(1)} km de distância',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF6b7280),
                    ),
                  ),
                ],
              ),
              const Divider(height: 16, color: Color(0xFFf3f4f6)),
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Ir para página da clínica',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1e40af),
                    ),
                  ),
                  SizedBox(width: 4),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: 13,
                    color: Color(0xFF1e40af),
                  ),
                ],
              ),
            ],
          ),
        ),
        const Align(
          alignment: Alignment.center,
          child: CustomPaint(
            size: Size(16, 8),
            painter: ClinicPinCalloutTailPainter(),
          ),
        ),
      ],
    );
  }
}

/// Close ("X") badge for [ClinicPinCalloutContent]. Rasterized once and reused.
class ClinicPinCalloutCloseButton extends StatelessWidget {
  const ClinicPinCalloutCloseButton({super.key});

  static const double size = 26;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFe5e7eb)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x40111827),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: const Icon(
        Icons.close_rounded,
        size: 15,
        color: Color(0xFF4b5563),
      ),
    );
  }
}

class ClinicPinCalloutTailPainter extends CustomPainter {
  const ClinicPinCalloutTailPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
