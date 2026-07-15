import 'package:atlasmed_mobile_app/features/visits/data/repositories/api_visit_repository.dart';

import 'package:atlasmed_mobile_app/features/visits/data/weekly_visit_summary.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final visitRepositoryProvider = Provider<VisitRepository>((ref) => VisitRepository());

final weeklyVisitSummaryProvider = FutureProvider<WeeklyVisitSummary>((ref) {
  return ref.watch(visitRepositoryProvider).getWeeklySummary();
});
