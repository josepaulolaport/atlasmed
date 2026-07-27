import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Edit facility-scoped doctor role flags (`PATCH …/professionals/:id`).
Future<FacilityCrmDoctor?> showEditDoctorRolesSheet(
  BuildContext context, {
  required FacilityCrmDoctor doctor,
  String? facilityId,
}) {
  return showModalBottomSheet<FacilityCrmDoctor>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) =>
        _EditDoctorRolesSheet(doctor: doctor, facilityId: facilityId),
  );
}

class _EditDoctorRolesSheet extends StatefulWidget {
  const _EditDoctorRolesSheet({required this.doctor, this.facilityId});

  final FacilityCrmDoctor doctor;
  final String? facilityId;

  @override
  State<_EditDoctorRolesSheet> createState() => _EditDoctorRolesSheetState();
}

class _EditDoctorRolesSheetState extends State<_EditDoctorRolesSheet> {
  late bool _isPartner;
  late bool _isPrescriber;
  late bool _isDecisionMaker;
  late bool _isBuyer;
  bool _saving = false;

  bool get _useApi {
    final id = widget.facilityId;
    if (id == null || id.isEmpty) return false;
    return !id.startsWith('near-') && !id.endsWith(':empty');
  }

  @override
  void initState() {
    super.initState();
    _isPartner = widget.doctor.isPartner;
    _isPrescriber = widget.doctor.isPrescriber;
    _isDecisionMaker = widget.doctor.isDecisionMaker;
    _isBuyer = widget.doctor.isBuyer;
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFe5e7eb),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const Text(
            'Papel na clínica',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.doctor.name,
            style: const TextStyle(fontSize: 13.5, color: AppColors.gray500),
          ),
          const SizedBox(height: 12),
          _roleToggle('Prescritor', _isPrescriber, (v) => _isPrescriber = v),
          _roleToggle('Decisor', _isDecisionMaker, (v) => _isDecisionMaker = v),
          _roleToggle('Comprador', _isBuyer, (v) => _isBuyer = v),
          _roleToggle('Sócio', _isPartner, (v) => _isPartner = v),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: const AppColors.navyBright,
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Salvar'),
          ),
        ],
      ),
    );
  }

  Widget _roleToggle(String label, bool value, ValueChanged<bool> onChanged) {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      dense: true,
      title: Text(
        label,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.gray900,
        ),
      ),
      value: value,
      activeThumbColor: const AppColors.navyBright,
      onChanged: (next) => setState(() => onChanged(next)),
    );
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      FacilityCrmDoctor updated;
      if (_useApi) {
        final repo = FacilityAssociateRepository(widget.facilityId!);
        try {
          updated = await repo.updateDoctorRoles(
            widget.doctor,
            isPartner: _isPartner,
            isPrescriber: _isPrescriber,
            isBuyer: _isBuyer,
            isDecisionMaker: _isDecisionMaker,
          );
        } finally {
          repo.dispose();
        }
      } else {
        updated = widget.doctor.copyWith(
          isPartner: _isPartner,
          isPrescriber: _isPrescriber,
          isBuyer: _isBuyer,
          isDecisionMaker: _isDecisionMaker,
          roleBadge: _isDecisionMaker ? 'DECISOR' : null,
          clearRoleBadge: !_isDecisionMaker,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop(updated);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is FacilityAssociateException
                ? (e.message ?? 'Não foi possível salvar o papel')
                : 'Não foi possível salvar o papel',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}
