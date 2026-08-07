import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/commercial_status.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/status_chip.dart';
import 'package:flutter/material.dart';

/// Builds commercial + funnel status chips from vertical profiles.
List<Widget> buildFacilityStatusChips({
  required List<FacilityVerticalProfileDTO> verticalProfiles,
  int? verticalId,
  bool small = true,
  bool onNavy = false,
}) {
  final chips = <Widget>[];
  final picked = pickVerticalProfile(verticalProfiles, verticalId: verticalId);

  final pickedCommercial = picked?.commercialStatus?.trim();
  if (pickedCommercial != null && pickedCommercial.isNotEmpty) {
    chips.add(
      StatusChip(
        label: CommercialStatusFilter.label(pickedCommercial),
        color: CommercialStatusFilter.color(pickedCommercial),
        bg: CommercialStatusFilter.bg(pickedCommercial),
        small: small,
        onNavy: onNavy,
      ),
    );
  } else {
    final withCommercial = verticalProfiles
        .where(
          (p) =>
              p.commercialStatus != null &&
              p.commercialStatus!.trim().isNotEmpty,
        )
        .toList(growable: false);
    if (withCommercial.length == 1) {
      final api = withCommercial.first.commercialStatus!;
      chips.add(
        StatusChip(
          label: CommercialStatusFilter.label(api),
          color: CommercialStatusFilter.color(api),
          bg: CommercialStatusFilter.bg(api),
          small: small,
          onNavy: onNavy,
        ),
      );
    } else if (withCommercial.length > 1) {
      for (final profile in withCommercial) {
        final api = profile.commercialStatus!;
        chips.add(
          StatusChip(
            label:
                '${_shortLinha(profile.verticalName)} · ${CommercialStatusFilter.label(api)}',
            color: CommercialStatusFilter.color(api),
            bg: CommercialStatusFilter.bg(api),
            small: small,
            onNavy: onNavy,
          ),
        );
      }
    }
  }

  final pickedFunnel = picked?.purchaseRecurrence?.funnelStage;
  if (pickedFunnel != null) {
    chips.add(
      StatusChip(
        label: pickedFunnel.label,
        color: pickedFunnel.color,
        bg: pickedFunnel.backgroundColor,
        small: small,
        onNavy: onNavy,
      ),
    );
  } else {
    final withFunnel = verticalProfiles
        .where((p) => p.purchaseRecurrence?.funnelStage != null)
        .toList(growable: false);
    if (withFunnel.length == 1) {
      final stage = withFunnel.first.purchaseRecurrence!.funnelStage!;
      chips.add(
        StatusChip(
          label: stage.label,
          color: stage.color,
          bg: stage.backgroundColor,
          small: small,
          onNavy: onNavy,
        ),
      );
    } else if (withFunnel.length > 1) {
      for (final profile in withFunnel) {
        final stage = profile.purchaseRecurrence!.funnelStage!;
        chips.add(
          StatusChip(
            label: '${_shortLinha(profile.verticalName)} · ${stage.label}',
            color: stage.color,
            bg: stage.backgroundColor,
            small: small,
            onNavy: onNavy,
          ),
        );
      }
    }
  }

  return chips;
}

String _shortLinha(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return 'Linha';
  // "Ortopédica" / "Estética" already short enough.
  if (trimmed.length <= 14) return trimmed;
  return '${trimmed.substring(0, 13)}…';
}
