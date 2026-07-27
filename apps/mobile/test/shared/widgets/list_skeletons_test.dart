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
}
