import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../shared/widgets/app_shell.dart';

/// Stub screen for Pedidos section.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: const Color(0xFFf7f8fb),
      body: SafeArea(
        child: Column(
          children: [
            const AtlasTopBar(page: 'Pedidos'),
            const Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.inventory_2_outlined, size: 48, color: Color(0xFFc8cdd5)),
                    SizedBox(height: 16),
                    Text(
                      'Pedidos',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF6b7280)),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Em breve',
                      style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
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
