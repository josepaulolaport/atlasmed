import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_admin_info_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Dedicated full-screen page for "Dados administrativos" — pushed from
/// the top shortcut card on the establishment detail screen. Reuses the
/// same field list (`ClinicAdminInfoSection`) that used to live inline at
/// the bottom of the main scroll.
class ClinicAdminInfoScreen extends StatelessWidget {
  const ClinicAdminInfoScreen({super.key, required this.detail});

  final ClinicDetail detail;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      appBar: AppBar(
        backgroundColor: const Color(0xFFf8f9fb),
        elevation: 0,
        foregroundColor: const AppColors.gray900,
        title: const Text('Dados administrativos'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [ClinicAdminInfoSection(detail: detail)],
      ),
    );
  }
}
