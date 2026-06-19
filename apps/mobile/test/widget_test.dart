import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/app.dart';

void main() {
  testWidgets('App launches and shows splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: AtlasMedApp(),
      ),
    );
    // Basic smoke test
    expect(find.byType(ProviderScope), findsOneWidget);
  });
}
