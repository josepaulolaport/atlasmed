import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Stub screen for Pedidos section.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: const AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            const AtlasTopBar(page: 'Pedidos'),
            const Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.inventory_2_outlined,
                      size: 48,
                      color: AppColors.gray300,
                    ),
                    SizedBox(height: 16),
                    Text(
                      'Pedidos',
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
