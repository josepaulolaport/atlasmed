import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/tax_identifier.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/editable_field_row.dart';

/// "Informações administrativas" — every field carries copy + pencil actions.
/// Address is split into Estado / Cidade / CEP / Endereço and kept last
/// (Endereço combines neighbourhood, street, number and complement).
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

    final fields = <({String label, String? value, IconData icon})>[
      (
        label: taxIdentifier.label,
        value: hasTaxId ? taxIdentifier.value : null,
        icon: Icons.badge_outlined,
      ),
      (
        label: 'Telefone',
        value: formatBrazilianPhone(detail.phone) ?? detail.phone,
        icon: Icons.phone_outlined,
      ),
      (
        label: 'WhatsApp',
        value: formatBrazilianPhone(detail.whatsapp) ?? detail.whatsapp,
        icon: Icons.chat_outlined,
      ),
      (label: 'E-mail', value: detail.email, icon: Icons.email_outlined),
      (label: 'Site', value: detail.website, icon: Icons.language_outlined),
      (
        label: 'Responsável',
        value: detail.responsibleDoctor,
        icon: Icons.medical_services_outlined,
      ),
      (
        label: 'Horário',
        value: detail.openingHours,
        icon: Icons.schedule_outlined,
      ),
      if (detail.registeredSince != null)
        (
          label: 'Cliente desde',
          value: _formatDate(detail.registeredSince!),
          icon: Icons.date_range_outlined,
        ),
      (label: 'Estado', value: detail.state, icon: Icons.map_outlined),
      (
        label: 'Cidade',
        value: detail.city.trim().isEmpty ? null : detail.city,
        icon: Icons.location_city_outlined,
      ),
      (
        label: 'CEP',
        value: detail.postalCode,
        icon: Icons.local_post_office_outlined,
      ),
      (
        label: 'Endereço',
        value: detail.composedAddressLine,
        icon: Icons.location_on_outlined,
      ),
    ];

    return ClinicDetailCard(
      // Rows own their padding so ink/separators can span the card edge-to-edge.
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 4),
              child: Row(
                children: [
                  Icon(
                    Icons.touch_app_outlined,
                    size: 13,
                    color: Color(0xFFb0b7c3),
                  ),
                  SizedBox(width: 6),
                  Text(
                    'Toque em um campo para copiar',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFFb0b7c3),
                    ),
                  ),
                ],
              ),
            ),
            for (var i = 0; i < fields.length; i++)
              EditableFieldRow(
                label: fields[i].label,
                value: fields[i].value,
                icon: fields[i].icon,
                showDivider: i < fields.length - 1,
              ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}
