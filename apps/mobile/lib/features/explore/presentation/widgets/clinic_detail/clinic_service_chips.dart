import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class ClinicServiceChips extends StatelessWidget {
  const ClinicServiceChips({super.key, required this.services});

  final List<FacilityServiceChip> services;

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: services
            .map(
              (s) => Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFeef4ff),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFdbeafe)),
                ),
                child: Text(
                  s.label,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: AppColors.navyBright,
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}
