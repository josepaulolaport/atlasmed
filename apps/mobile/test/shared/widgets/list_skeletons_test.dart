import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'all list loading placeholders render shimmer instead of spinners',
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
                ],
              ),
            ),
          ),
        ),
      );

      expect(find.byType(Shimmer), findsNWidgets(8));
      expect(find.byType(CircularProgressIndicator), findsNothing);
    },
  );

  testWidgets(
    'keeps the skeleton visible without a shimmer when animations are disabled',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: true),
            child: Scaffold(
              body: Shimmer(child: SizedBox(key: Key('skeleton-content'))),
            ),
          ),
        ),
      );

      expect(find.byKey(const Key('skeleton-content')), findsOneWidget);
      expect(find.byType(ShaderMask), findsNothing);

      await tester.pump(const Duration(seconds: 2));
      expect(find.byKey(const Key('skeleton-content')), findsOneWidget);
    },
  );
}
