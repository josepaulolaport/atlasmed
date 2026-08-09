import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/person_facility_roles_catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/person_facility_role_toggles.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Edit facility-scoped doctor roles
/// (`PUT …/healthcare-professionals/:personFacilityId/roles`).
Future<ProfessionalRoster?> showEditDoctorRolesSheet(
  BuildContext context, {
  required ProfessionalRoster doctor,
  int? facilityId,
}) {
  return showModalBottomSheet<ProfessionalRoster>(
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

  final ProfessionalRoster doctor;
  final int? facilityId;

  @override
  State<_EditDoctorRolesSheet> createState() => _EditDoctorRolesSheetState();
}

class _EditDoctorRolesSheetState extends State<_EditDoctorRolesSheet> {
  late Set<int> _selected;
  late Set<int> _initial;
  List<PersonFacilityRoleCatalogEntry> _catalog = const [];
  bool _loadingCatalog = true;
  String? _catalogError;
  bool _saving = false;

  bool get _useApi {
    final id = widget.facilityId;
    return id != null && id > 0;
  }

  @override
  void initState() {
    super.initState();
    _selected = {...widget.doctor.roleIds};
    _initial = Set<int>.from(_selected);
    _loadCatalog();
  }

  Future<void> _loadCatalog() async {
    final repo = PersonFacilityRolesCatalogRepository();
    try {
      final roles = await repo.listActive();
      if (!mounted) return;
      setState(() {
        _loadingCatalog = false;
        _catalog = roles;
        if (roles.isEmpty) {
          _catalogError = 'Catálogo de papéis vazio';
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingCatalog = false;
        _catalogError = 'Não foi possível carregar os papéis';
        _catalog = const [];
      });
    } finally {
      repo.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + bottom),
      child: SingleChildScrollView(
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
                  color: AppColors.gray200,
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
            if (_catalogError != null) ...[
              const SizedBox(height: 8),
              Text(
                _catalogError!,
                style: const TextStyle(fontSize: 12, color: AppColors.gray500),
              ),
            ],
            const SizedBox(height: 12),
            if (_loadingCatalog)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              )
            else
              PersonFacilityRoleToggles(
                catalog: _catalog,
                selected: _selected,
                enabled: !_saving,
                onChanged: (next) => setState(() => _selected = next),
              ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _saving || _loadingCatalog ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.navyBright,
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
      ),
    );
  }

  Future<void> _save() async {
    final ids = PersonFacilityRoleCatalog.sortedIds(_selected);
    final unchanged =
        ids.toSet().difference(_initial).isEmpty &&
        _initial.difference(ids.toSet()).isEmpty;
    if (unchanged) {
      if (!mounted) return;
      Navigator.of(context).pop(widget.doctor);
      return;
    }

    setState(() => _saving = true);
    try {
      ProfessionalRoster updated;
      if (_useApi) {
        final repo = FacilityAssociateRepository(widget.facilityId!);
        try {
          updated = await repo.updateDoctorRoles(
            widget.doctor,
            roleIds: ids,
            catalog: _catalog,
          );
        } finally {
          repo.dispose();
        }
      } else {
        updated = widget.doctor.copyWith(roleIds: ids);
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
