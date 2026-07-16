import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/filter_data.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/clinic_detail_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('abre os contatos disponíveis da clínica', (tester) async {
    final launchedUrls = <String>[];
    const channel = MethodChannel('plugins.flutter.io/url_launcher');
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      call,
    ) async {
      if (call.method == 'launch') {
        launchedUrls.add(
          (call.arguments as Map<Object?, Object?>)['url']! as String,
        );
        return true;
      }
      return false;
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );

    const detail = ClinicDetail(
      id: 'clinic-1',
      name: 'Clínica Central',
      city: 'São Paulo',
      neighborhood: 'Centro',
      distanceKm: 1,
      status: ClinicStatus.active,
      doctorCount: 0,
      isPriority: false,
      products: [],
      phone: '(11) 99876-5432',
      whatsapp: '+55 (11) 99876-5432',
      email: 'contato@clinica.com.br',
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          clinicDetailProvider('clinic-1').overrideWith((ref) async => detail),
          clinicVisitsProvider(
            'clinic-1',
          ).overrideWith((ref) async => const []),
        ],
        child: const MaterialApp(
          home: ClinicDetailScreen(clinicId: 'clinic-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ligar'));
    await tester.pump();
    await tester.tap(find.text('WhatsApp'));
    await tester.pump();
    await tester.tap(find.text('E-mail').first);
    await tester.pump();

    expect(launchedUrls, [
      'tel:5511998765432',
      'https://wa.me/5511998765432',
      'mailto:contato@clinica.com.br',
    ]);
  });
}
