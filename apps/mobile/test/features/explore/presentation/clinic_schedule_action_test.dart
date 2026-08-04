import 'package:atlasmed_mobile_app/features/agenda/data/calendar_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/screens/clinic_detail_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets(
    'clinic quick action opens calendar editor with typed interaction prefill',
    (tester) async {
      CalendarEditorPrefill? received;
      final router = GoRouter(
        initialLocation: '/clinic',
        routes: [
          GoRoute(
            path: '/clinic',
            builder: (_, _) => const Scaffold(
              body: ClinicDetailQuickActions(
                detail: Facility(id: 'facility-1', name: 'Clínica Central'),
                canCreateVisit: true,
              ),
            ),
          ),
          GoRoute(
            path: '/agenda/new',
            builder: (_, state) {
              received = state.extra as CalendarEditorPrefill;
              return const Scaffold(body: Text('Editor aberto'));
            },
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            theme: AppTheme.light,
            routerConfig: router,
          ),
        ),
      );
      await tester.tap(find.text('Agendar interação'));
      await tester.pumpAndSettle();

      expect(find.text('Editor aberto'), findsOneWidget);
      expect(received?.facilityId, 'facility-1');
      expect(received?.facilityName, 'Clínica Central');
      expect(received?.kind, CalendarEventKind.interaction);
    },
  );
}
