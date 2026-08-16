import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

/// `Administração` (spec 0016 §3.3) — the hub the drawer lands on.
///
/// A sectioned list of destinations rather than a screen that edits anything
/// itself. The drawer is already a flat list of ten branches; a second flat
/// list of a dozen entity screens inside it would be unreadable, and a tab
/// shell would put unrelated entities one swipe apart.
///
/// Each row pushes onto the root navigator, so every entity screen gets a back
/// button to here and the drawer stays one level up.
class AdminHomeScreen extends StatelessWidget {
  const AdminHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Administração'),
      body: SafeArea(
        child: ListView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            const Text(
              'Administração',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: AppColors.navyDeep,
                letterSpacing: -0.6,
                height: 1.1,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Os cadastros que o resto do aplicativo consome.',
              style: TextStyle(fontSize: 12.5, color: AppColors.gray400),
            ),
            const SizedBox(height: 20),
            const _AdminSectionHeader('Catálogo comercial'),
            _AdminDestinationCard(
              icon: Icons.medication_liquid_outlined,
              label: 'Produtos',
              description: 'Nossos produtos, equivalências e métricas',
              onTap: () => const AdminProductsRoute().push(context),
            ),
            _AdminDestinationCard(
              icon: Icons.storefront_outlined,
              label: 'Produtos concorrentes',
              description: 'Os produtos das outras marcas',
              onTap: () => const AdminCompetitorProductsRoute().push(context),
            ),
            _AdminDestinationCard(
              icon: Icons.insights_outlined,
              label: 'Métricas',
              description: 'Campos de potencial por linha comercial',
              onTap: () => const AdminMetricsRoute().push(context),
            ),
            const SizedBox(height: 10),
            const _AdminSectionHeader('Clínicas'),
            _AdminDestinationCard(
              icon: Icons.account_balance_wallet_outlined,
              label: 'Fontes pagadoras',
              description: 'Quem paga: convênios, público, particular',
              onTap: () => const AdminHealthcareProvidersRoute().push(context),
            ),
            _AdminDestinationCard(
              icon: Icons.restore_from_trash_outlined,
              label: 'Clínicas desativadas',
              description: 'Reative uma clínica que foi removida por engano',
              onTap: () =>
                  const AdminDeactivatedFacilitiesRoute().push(context),
            ),
            _AdminDestinationCard(
              icon: Icons.fact_check_outlined,
              label: 'Requisitos de cadastro',
              description: 'Os documentos que o cadastro pede de cada clínica',
              onTap: () =>
                  const AdminConformityRequirementsRoute().push(context),
            ),
            const SizedBox(height: 10),
            const _AdminSectionHeader('Catálogos de apoio'),
            _AdminDestinationCard(
              icon: Icons.list_alt_rounded,
              label: 'Catálogos',
              description: 'Especialidades, focos clínicos, papéis, conselhos',
              onTap: () => const AdminSupportCatalogsRoute().push(context),
            ),
            // Linhas are absent by decision, not oversight — spec 0016 §4.1:
            // near-static data, immutable `code`.
          ],
        ),
      ),
    );
  }
}

class _AdminSectionHeader extends StatelessWidget {
  const _AdminSectionHeader(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
        color: AppColors.gray400,
      ),
    ),
  );
}

class _AdminDestinationCard extends StatelessWidget {
  const _AdminDestinationCard({
    required this.icon,
    required this.label,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.surfaceSecondary),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.blue50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 20, color: AppColors.navyDeep),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        label,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gray900,
                          letterSpacing: -0.1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        description,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.gray400,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.gray400,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
