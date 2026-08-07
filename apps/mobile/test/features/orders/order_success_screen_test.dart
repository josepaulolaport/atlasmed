import 'package:atlasmed_mobile_app/features/orders/presentation/screens/order_success_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('success screen renders after cart clear', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: const OrderSuccessScreen(),
        ),
      ),
    );
    await tester.pump();

    // Screen currently shows placeholder labels after cart clear.
    expect(find.textContaining('pedido'), findsWidgets);
  });
}
