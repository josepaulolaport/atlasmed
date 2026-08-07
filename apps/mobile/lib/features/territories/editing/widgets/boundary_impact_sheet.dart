import 'package:atlasmed_mobile_app/features/territories/data/models/boundary_impact.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Spec 0006: per-clinic accept deassign confirmation before boundary save.
class BoundaryImpactSheet extends StatefulWidget {
  const BoundaryImpactSheet({super.key, required this.clinics});

  final List<BoundaryImpactClinic> clinics;

  /// Returns `true` only when every clinic is checked and user confirms.
  static Future<bool> confirm(
    BuildContext context, {
    required List<BoundaryImpactClinic> clinics,
  }) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BoundaryImpactSheet(clinics: clinics),
    );
    return result == true;
  }

  @override
  State<BoundaryImpactSheet> createState() => _BoundaryImpactSheetState();
}

class _BoundaryImpactSheetState extends State<BoundaryImpactSheet> {
  late final Set<int> _accepted;

  @override
  void initState() {
    super.initState();
    _accepted = {};
  }

  bool get _allAccepted =>
      widget.clinics.every((c) => _accepted.contains(c.facilityId));

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final clinics = widget.clinics;
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.72,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.gray200,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Impacto na propriedade',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0f1729),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  clinics.length == 1
                      ? 'Marque a clínica abaixo para aceitar a remoção do consultor e salvar o novo contorno.'
                      : 'Marque cada clínica para aceitar a remoção do consultor. Todas devem ser aceitas para salvar.',
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.35,
                    color: AppColors.gray600,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.gray100),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: clinics.length,
              separatorBuilder: (_, _) =>
                  const Divider(height: 1, indent: 20, endIndent: 20),
              itemBuilder: (context, index) {
                final clinic = clinics[index];
                final checked = _accepted.contains(clinic.facilityId);
                return CheckboxListTile(
                  value: checked,
                  controlAffinity: ListTileControlAffinity.leading,
                  onChanged: (value) {
                    setState(() {
                      if (value == true) {
                        _accepted.add(clinic.facilityId);
                      } else {
                        _accepted.remove(clinic.facilityId);
                      }
                    });
                  },
                  title: Text(
                    clinic.facilityName.isNotEmpty
                        ? clinic.facilityName
                        : clinic.facilityId.toString(),
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  subtitle: Text(
                    clinic.consultantName.isNotEmpty
                        ? 'Consultor: ${clinic.consultantName}'
                        : 'Consultor atribuído',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.gray600,
                    ),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + bottom),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _allAccepted
                        ? () => Navigator.of(context).pop(true)
                        : null,
                    child: const Text('Aceitar e salvar'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
