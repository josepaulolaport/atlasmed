import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_field_notes_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_header_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_potential_section.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('header owns its loading skeleton', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(body: ClinicHeaderSection(detail: null, photos: null)),
        ),
      ),
    );

    expect(find.byType(ClinicHeaderSkeleton), findsOneWidget);
    expect(find.byType(AtlasShimmer), findsOneWidget);
  });

  testWidgets('field notes owns its loading skeleton', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ClinicFieldNotesSection(
              facilityId: 'facility-1',
              notes: null,
              canAdd: true,
              onCreate: (_) async {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Notas de campo'), findsOneWidget);
    expect(find.byType(AtlasShimmer), findsOneWidget);
  });

  testWidgets('potential owns its loading skeleton', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ClinicPotentialSection(
              verticalId: 'vertical-1',
              page: null,
              canEdit: true,
              onSave: (_) async {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Potencial & share'), findsOneWidget);
    expect(find.byType(AtlasShimmer), findsOneWidget);
  });
}
