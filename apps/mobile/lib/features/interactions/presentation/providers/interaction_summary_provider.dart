import 'package:atlasmed_mobile_app/features/interactions/data/repositories/api_interaction_repository.dart';

import 'package:atlasmed_mobile_app/features/interactions/data/weekly_interaction_summary.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final interactionRepositoryProvider = Provider<InteractionRepository>(
  (ref) => InteractionRepository(),
);

final weeklyInteractionSummaryProvider =
    FutureProvider<WeeklyInteractionSummary>((ref) {
      return ref.watch(interactionRepositoryProvider).getWeeklySummary();
    });
