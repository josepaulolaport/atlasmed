import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/clinical_focus_labels.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/facility_status_chips.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class ClinicRow extends StatelessWidget {
  /// The full entry. Null on [ClinicRow.summary].
  final FacilityEntry? clinic;
  final VoidCallback onTap;

  /// Optional control at the end of the row.
  ///
  /// Explorar passes nothing and keeps the row exactly as it was. Desempenho's
  /// breakdown uses it for the `⋯` menu it needs on a rep's own caseload — the
  /// reason it had grown a private copy of this row in the first place.
  final Widget? trailing;

  /// Set by [ClinicRow.summary] when the caller's endpoint returns a name and
  /// a place and nothing else.
  final String? _summaryName;
  final String? _summaryLocation;
  final List<Widget> _summaryBadges;

  const ClinicRow({
    super.key,
    required FacilityEntry this.clinic,
    required this.onTap,
    this.trailing,
  }) : _summaryName = null,
       _summaryLocation = null,
       _summaryBadges = const [];

  /// The same row for a list that only knows a clinic's name and where it is.
  ///
  /// "Associar clínica" had grown its own row because `/assignable` returns
  /// neither doctor counts nor clinical focus — and mapping it onto
  /// [FacilityEntry] would have printed "0 médicos" and "Sem foco clínico" as
  /// if they were facts about the clinic. This keeps one row and one visual
  /// language, and draws only what the caller actually knows.
  const ClinicRow.summary({
    super.key,
    required String name,
    required String location,
    required this.onTap,
    List<Widget> badges = const [],
    this.trailing,
  }) : clinic = null,
       _summaryName = name,
       _summaryLocation = location,
       _summaryBadges = badges;

  @override
  Widget build(BuildContext context) {
    final entry = clinic;
    if (entry == null) return _buildSummary();

    final statusChips = buildFacilityStatusChips(
      verticalProfiles: entry.verticalProfiles,
    );
    final serviceChip = ClinicalFocusLabels.chipSummary(entry.displayServices);

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.blue100, AppColors.blueLight],
                    ),
                  ),
                  child: const Icon(
                    Icons.local_hospital_rounded,
                    size: 22,
                    color: AppColors.navyBright,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  if (entry.locationLabel != null) ...[
                    const SizedBox(height: 3),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 2),
                          child: Icon(
                            Icons.location_on_rounded,
                            size: 11,
                            color: AppColors.gray500,
                          ),
                        ),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            entry.locationLabel!,
                            softWrap: true,
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: AppColors.gray500,
                              height: 1.25,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 3),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (entry.distanceKm != null)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.near_me_rounded,
                              size: 11,
                              color: AppColors.gray500,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${entry.distanceKm!.toStringAsFixed(1)} km',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w500,
                                color: AppColors.gray500,
                              ),
                            ),
                          ],
                        ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.person_outline_rounded,
                            size: 11,
                            color: AppColors.gray500,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${entry.doctorCount} ${entry.doctorCount == 1 ? 'médico' : 'médicos'}',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                              color: AppColors.gray500,
                            ),
                          ),
                        ],
                      ),
                      if (serviceChip.label != null) ...[
                        _ServiceChip(label: serviceChip.label!),
                        if (serviceChip.overflow > 0)
                          _ServiceChip(label: '+${serviceChip.overflow}'),
                      ] else
                        const _ServiceChip(
                          label: 'Sem foco clínico',
                          muted: true,
                        ),
                    ],
                  ),
                  if (statusChips.isNotEmpty ||
                      entry.lastVisitDays != null) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        ...statusChips,
                        if (entry.lastVisitDays != null)
                          _MetaItem(
                            icon: Icons.access_time_rounded,
                            text: entry.lastVisitDays == 0
                                ? 'Hoje'
                                : 'Há ${entry.lastVisitDays} dia${entry.lastVisitDays == 1 ? '' : 's'}',
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          ],
        ),
      ),
    );
  }
}

/// The same tile, name, location line and divider as the full row — only the
/// meta line differs, because a summary caller has no meta to show.
extension on ClinicRow {
  Widget _buildSummary() {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.surfaceSecondary)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.blue100, AppColors.blueLight],
                ),
              ),
              child: const Icon(
                Icons.local_hospital_rounded,
                size: 22,
                color: AppColors.navyBright,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _summaryName ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                      letterSpacing: -0.15,
                    ),
                  ),
                  if ((_summaryLocation ?? '').isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 2),
                          child: Icon(
                            Icons.location_on_rounded,
                            size: 11,
                            color: AppColors.gray500,
                          ),
                        ),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            _summaryLocation!,
                            softWrap: true,
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: AppColors.gray500,
                              height: 1.25,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (_summaryBadges.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: _summaryBadges,
                    ),
                  ],
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          ],
        ),
      ),
    );
  }
}

class _ServiceChip extends StatelessWidget {
  const _ServiceChip({required this.label, this.muted = false});

  final String label;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final bg = muted
        ? AppColors.gray100
        : AppColors.navyBright.withValues(alpha: 0.08);
    final border = muted
        ? AppColors.gray200
        : AppColors.navyBright.withValues(alpha: 0.18);
    final fg = muted ? AppColors.gray500 : AppColors.navyDeep;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w600,
          color: fg,
          height: 1.1,
        ),
      ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  final IconData icon;
  final String text;

  const _MetaItem({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 11, color: AppColors.gray500),
        const SizedBox(width: 4),
        Text(
          text,
          style: const TextStyle(fontSize: 11.5, color: AppColors.gray500),
        ),
      ],
    );
  }
}
