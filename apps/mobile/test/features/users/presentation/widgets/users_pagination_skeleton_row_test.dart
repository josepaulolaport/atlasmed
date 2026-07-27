import 'package:atlasmed_mobile_app/features/users/presentation/widgets/users_empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders a shimmer placeholder shaped like a user row', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: UsersPaginationSkeletonRow())),
    );

    expect(find.byType(UsersPaginationSkeletonRow), findsOneWidget);
    expect(find.byType(UsersSkeletonRow), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}
