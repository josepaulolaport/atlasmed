import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'all list loading placeholders render AtlasShimmer instead of spinners',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: Column(
                children: [
                  ReviewListSkeleton(),
                  SuggestionListSkeleton(),
                  OrderListSkeleton(),
                  InvitationListSkeleton(),
                  ProductListSkeleton(),
                  CompetitorListSkeleton(),
                  CompetitorPickerListSkeleton(),
                  UserPickerListSkeleton(),
                  TeamListSkeleton(),
                  SimpleListSkeleton(),
                ],
              ),
            ),
          ),
        ),
      );

      expect(find.byType(AtlasShimmer), findsNWidgets(10));
      expect(find.byType(CircularProgressIndicator), findsNothing);
    },
  );

  testWidgets('keeps the skeleton visible without a shimmer when disabled', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AtlasShimmer(
            enabled: false,
            child: SizedBox(key: Key('skeleton-content')),
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('skeleton-content')), findsOneWidget);
    expect(find.byType(ShaderMask), findsNothing);

    await tester.pump(const Duration(seconds: 2));
    expect(find.byKey(const Key('skeleton-content')), findsOneWidget);
  });
}
