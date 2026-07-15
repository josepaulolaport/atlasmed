import 'package:atlasmed_mobile_app/features/visits/data/weekly_visit_summary.dart';

abstract class VisitRepository {
  Future<WeeklyVisitSummary> getWeeklySummary();
}
