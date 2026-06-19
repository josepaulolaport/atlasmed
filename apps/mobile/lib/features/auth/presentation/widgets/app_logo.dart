import 'package:flutter/material.dart';

/// AtlasMed logo using the app's asset image.
class AppLogo extends StatelessWidget {
  final double size;
  final String? subtitle;

  const AppLogo({super.key, this.size = 140, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(
          'assets/atlasmed-logo.png',
          width: size,
          height: size * 0.54,
          fit: BoxFit.contain,
          // Fallback: if asset doesn't exist yet, show text
          errorBuilder: (_, _, _) => Text(
            'atlasmed',
            style: TextStyle(
              fontSize: size * 0.2,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: -1,
            ),
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(
            subtitle!,
            style: TextStyle(
              fontSize: 11,
              letterSpacing: 4,
              color: Colors.white.withValues(alpha: 0.6),
            ),
          ),
        ],
      ],
    );
  }
}
