import 'package:flutter/material.dart';
import '../../../../shared/theme/app_theme.dart';

/// Deep-blue gradient mesh with soft animated orbs.
class BlueBackdrop extends StatelessWidget {
  const BlueBackdrop({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment(-0.2, -0.2),
          end: Alignment(1.2, 1.2),
          colors: [
            AppColors.backdropStart,
            AppColors.backdropMid,
            AppColors.backdropEnd,
          ],
        ),
      ),
    );
  }
}
