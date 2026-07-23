import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/tax_identifier.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_address_suggestion_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_tax_id_type_suggestion_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/editable_field_row.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/data/nao_conformidade_models.dart';

/// "Informações administrativas" — every field carries copy + pencil actions.
/// Address is shown as Estado / Cidade / CEP / Endereço (composed line).
/// Editing "Endereço" opens a multi-field sheet (bairro / logradouro /
/// número / complemento).
class ClinicAdminInfoSection extends ConsumerWidget {
  const ClinicAdminInfoSection({super.key, required this.detail});

  final ClinicDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasTaxId =
        (detail.cnpj?.trim().isNotEmpty ?? false) ||
        (detail.cpf?.trim().isNotEmpty ?? false);
    final taxIdentifier = displayTaxIdentifier(
      taxIdType: detail.taxIdType,
      cnpj: detail.cnpj,
      cpf: detail.cpf,
    );
    final taxIdType = parseFacilityTaxIdType(detail.taxIdType);
    final taxTypeLabel = switch (taxIdType) {
      FacilityTaxIdType.pf => 'Pessoa Física (PF)',
      FacilityTaxIdType.pj => 'Pessoa Jurídica (PJ)',
      null => null,
    };
    final taxFieldKey = switch (taxIdentifier.label.toUpperCase()) {
      'CNPJ' => 'cnpj',
      'CPF' => 'cpf',
      _ => null,
    };

    final suggestionTarget = EditSuggestionTarget(
      type: NaoConformidadeTargetType.clinic,
      id: detail.id,
      name: detail.name,
    );

    final fields =
        <
          ({
            String label,
            String? value,
            IconData icon,
            VoidCallback? onEdit,
            String? fieldKey,
            bool editable,
          })
        >[
          (
            label: 'Tipo',
            value: taxTypeLabel,
            icon: Icons.category_outlined,
            onEdit: () => showTaxIdTypeSuggestionSheet(
              context,
              currentTaxIdType: detail.taxIdType,
            ),
          ),
          (
            label: taxIdentifier.label,
            value: hasTaxId ? taxIdentifier.value : null,
            icon: Icons.badge_outlined,
            onEdit: null,
            fieldKey: taxFieldKey,
            editable: taxFieldKey != null,
          ),
          (
            label: 'Telefone',
            value: formatBrazilianPhone(detail.phone) ?? detail.phone,
            icon: Icons.phone_outlined,
            onEdit: null,
            fieldKey: 'phoneNumber',
            editable: true,
          ),
          (
            label: 'WhatsApp',
            value: formatBrazilianPhone(detail.whatsapp) ?? detail.whatsapp,
            icon: Icons.chat_outlined,
            onEdit: null,
            fieldKey: 'whatsappNumber',
            editable: true,
          ),
          (
            label: 'E-mail',
            value: detail.email,
            icon: Icons.email_outlined,
            onEdit: null,
            fieldKey: 'email',
            editable: true,
          ),
          (
            label: 'Site',
            value: detail.website,
            icon: Icons.language_outlined,
            onEdit: null,
            fieldKey: 'websiteUrl',
            editable: true,
          ),
          (
            label: 'Responsável',
            value: detail.responsibleDoctor,
            icon: Icons.medical_services_outlined,
            onEdit: null,
            fieldKey: 'responsibleName',
            editable: true,
          ),
          (
            label: 'Horário',
            value: detail.openingHours,
            icon: Icons.schedule_outlined,
            onEdit: null,
            fieldKey: 'openingHours',
            editable: true,
          ),
          if (detail.registeredSince != null)
            (
              label: 'Cliente desde',
              value: _formatDate(detail.registeredSince!),
              icon: Icons.date_range_outlined,
              onEdit: null,
              fieldKey: null,
              editable: false,
            ),
          (
            label: 'Estado',
            value: detail.state,
            icon: Icons.map_outlined,
            onEdit: null,
            fieldKey: null,
            editable: false,
          ),
          (
            label: 'Cidade',
            value: detail.city.trim().isEmpty ? null : detail.city,
            icon: Icons.location_city_outlined,
            onEdit: null,
            fieldKey: null,
            editable: false,
          ),
          (
            label: 'CEP',
            value: detail.postalCode,
            icon: Icons.local_post_office_outlined,
            onEdit: null,
            fieldKey: null,
            editable: false,
          ),
          (
            label: 'Endereço',
            value: detail.composedAddressLine,
            icon: Icons.location_on_outlined,
            onEdit: () => showAddressEditSuggestionSheet(
              context,
              ref: ref,
              facilityId: detail.id,
              neighborhood: detail.neighborhood,
              streetAddress: detail.streetAddress,
              streetNumber: detail.streetNumber,
              addressComplement: detail.addressComplement,
              city: detail.city,
              state: detail.state,
              postalCode: detail.postalCode,
            ),
            fieldKey: 'address',
            editable: true,
          ),
        ];

    return ClinicDetailCard(
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
                onEdit: fields[i].onEdit,
                showDivider: i < fields.length - 1,
                fieldKey: fields[i].fieldKey,
                showEditButton: fields[i].editable,
                suggestionTarget: fields[i].editable ? suggestionTarget : null,
              ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}
