import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/shared/widgets/subscreen_app_bar.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Stub screen for Apresentações section.
class PresentationsScreen extends ConsumerWidget {
  const PresentationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const SubscreenAppBar(title: 'Apresentações'),
      body: SafeArea(
        child: Column(
          children: [
            const Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.slideshow_outlined,
                      size: 48,
                      color: AppColors.gray300,
                    ),
                    SizedBox(height: 16),
                    Text(
                      'Apresentações',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray500,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Em breve',
                      style: TextStyle(fontSize: 13, color: AppColors.gray400),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
