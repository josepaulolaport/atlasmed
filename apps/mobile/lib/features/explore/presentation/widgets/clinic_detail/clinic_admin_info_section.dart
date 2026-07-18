import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/tax_identifier.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/editable_field_row.dart';

/// "Informações administrativas" — every field carries a pencil that opens
/// the suggestion sheet ("suggestion_flow" decision), replacing the single
/// generic "sugerir edição" banner. Empty fields show a "+ Completar" chip.
class ClinicAdminInfoSection extends StatelessWidget {
  const ClinicAdminInfoSection({super.key, required this.detail});

  final ClinicDetail detail;

  @override
  Widget build(BuildContext context) {
    final hasTaxId =
        (detail.cnpj?.trim().isNotEmpty ?? false) ||
        (detail.cpf?.trim().isNotEmpty ?? false);
    final taxIdentifier = displayTaxIdentifier(
      taxIdType: detail.taxIdType,
      cnpj: detail.cnpj,
      cpf: detail.cpf,
    );

    return ClinicDetailCard(
      child: Column(
        children: [
          EditableFieldRow(
            label: taxIdentifier.label,
            value: hasTaxId ? taxIdentifier.value : null,
            icon: Icons.badge_outlined,
          ),
          EditableFieldRow(
            label: 'Endereço',
            value: detail.streetAddress,
            icon: Icons.location_on_outlined,
          ),
          EditableFieldRow(
            label: 'Telefone',
            value: detail.phone,
            icon: Icons.phone_outlined,
          ),
          EditableFieldRow(
            label: 'E-mail',
            value: detail.email,
            icon: Icons.email_outlined,
          ),
          EditableFieldRow(
            label: 'Site',
            value: detail.website,
            icon: Icons.language_outlined,
          ),
          EditableFieldRow(
            label: 'Responsável',
            value: detail.responsibleDoctor,
            icon: Icons.medical_services_outlined,
          ),
          EditableFieldRow(
            label: 'Horário',
            value: detail.openingHours,
            icon: Icons.schedule_outlined,
          ),
          if (detail.registeredSince != null)
            EditableFieldRow(
              label: 'Cliente desde',
              value: _formatDate(detail.registeredSince!),
              icon: Icons.date_range_outlined,
            ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}
