import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// One assignment held outside the rep's own patches (spec 0009 R2).
class OutOfTerritoryAssignment {
  const OutOfTerritoryAssignment({
    required this.facilityId,
    required this.facilityName,
    required this.overrideReason,
    this.overrideByName,
  });

  final int facilityId;
  final String facilityName;

  /// Why it was allowed. Required by a check constraint alongside the author,
  /// so this is never empty on a real row.
  final String overrideReason;
  final String? overrideByName;

  factory OutOfTerritoryAssignment.fromJson(Map<String, dynamic> json) {
    return OutOfTerritoryAssignment(
      facilityId: readCrmId(json['facilityId'], 'facilityId'),
      facilityName: json['facilityName'] as String? ?? '',
      overrideReason: json['overrideReason'] as String? ?? '',
      overrideByName: json['overrideByName'] as String?,
    );
  }
}

class _OutOfTerritoryRepository
    extends Repository<List<OutOfTerritoryAssignment>>
    with SessionEnvironmentMixin<List<OutOfTerritoryAssignment>> {
  _OutOfTerritoryRepository({required int userId})
    : super(
        name: 'OutOfTerritoryRepository($userId)',
        endpoint: Uri.parse(
          '${AppConfig.apiBaseUrl}/api/v1/facilities/out-of-territory-assignments',
        ).replace(queryParameters: {'userId': '$userId', 'limit': '100'}),
      );

  @override
  List<OutOfTerritoryAssignment> fromJson(String json) {
    final decoded = jsonDecode(json);
    if (decoded is! Map<String, dynamic>) return const [];
    return (decoded['data'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(OutOfTerritoryAssignment.fromJson)
        .toList(growable: false);
  }
}

final _outOfTerritoryProvider = Provider.autoDispose
    .family<Repository<List<OutOfTerritoryAssignment>>, int>((ref, userId) {
      final repository = _OutOfTerritoryRepository(userId: userId);
      ref.onDispose(repository.dispose);
      return repository;
    });

/// Clinics a rep holds that no patch of theirs covers (spec 0009 R2).
///
/// The report R2 asked for. Overrides are deliberate and survive boundary
/// edits, so they accumulate quietly — this is the only place they are visible
/// as a set rather than one clinic at a time.
class OutOfTerritoryScreen extends ConsumerWidget {
  const OutOfTerritoryScreen({
    super.key,
    required this.userId,
    this.memberName,
  });

  final int userId;
  final String? memberName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Fora do território')),
      body: RefreshIndicator(
        color: AppColors.navyBright,
        backgroundColor: Colors.white,
        strokeWidth: 2.6,
        onRefresh: () async => ref.invalidate(_outOfTerritoryProvider(userId)),
        child: RepositoryBuilder(
          repository: ref.watch(_outOfTerritoryProvider(userId)),
          builder: (context, rows, repo) {
            if (rows == null) {
              return const Center(child: CircularProgressIndicator());
            }
            if (rows.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 32, vertical: 64),
                    child: Text(
                      'Todas as clínicas estão dentro do território.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: AppColors.gray500),
                    ),
                  ),
                ],
              );
            }

            return ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: rows.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Text(
                      memberName == null
                          ? '${rows.length} atribuições com justificativa.'
                          : '$memberName atende ${rows.length} '
                                '${rows.length == 1 ? 'clínica' : 'clínicas'} '
                                'fora dos seus patches.',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.gray500,
                        height: 1.35,
                      ),
                    ),
                  );
                }
                return _OverrideRow(row: rows[index - 1]);
              },
            );
          },
        ),
      ),
    );
  }
}

class _OverrideRow extends StatelessWidget {
  const _OverrideRow({required this.row});

  final OutOfTerritoryAssignment row;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => ClinicDetailRoute(id: row.facilityId).push(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    row.facilityName,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // The reason is the point of the record, so it is the row's
                  // subtitle rather than something behind a tap.
                  Text(
                    row.overrideReason,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.gray900,
                      height: 1.3,
                    ),
                  ),
                  if (row.overrideByName != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      'Autorizado por ${row.overrideByName}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.gray500,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: AppColors.gray500,
            ),
          ],
        ),
      ),
    );
  }
}
