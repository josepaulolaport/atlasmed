import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_codes.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/person_facility_roles_catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/person_facility_role_toggles.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

// Create body → POST /facilities/:id/healthcare-professionals
// (firstName/lastName/mobilePhone/email/roleTitle), then PUT …/roles when
// role toggles are selected.

/// Create a doctor profile. When [facilityId] is a real facility, persists via
/// `POST /facilities/:id/healthcare-professionals`.
Future<ProfessionalRoster?> showCreateDoctorProfileSheet(
  BuildContext context, {
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
    builder: (_) => _CreateDoctorProfileSheet(facilityId: facilityId),
  );
}

class _CreateDoctorProfileSheet extends StatefulWidget {
  const _CreateDoctorProfileSheet({this.facilityId});

  final int? facilityId;

  @override
  State<_CreateDoctorProfileSheet> createState() =>
      _CreateDoctorProfileSheetState();
}

class _CreateDoctorProfileSheetState extends State<_CreateDoctorProfileSheet> {
  final _nameCtrl = TextEditingController();
  final _specialtyCtrl = TextEditingController();
  final _crmCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  Set<String> _selectedRoles = {PersonFacilityRoleCodes.prescriber};
  List<PersonFacilityRoleCatalogEntry> _catalog = const [];
  bool _loadingCatalog = true;
  bool _saving = false;

  bool get _useApi {
    final id = widget.facilityId;
    return id != null && id > 0;
  }

  @override
  void initState() {
    super.initState();
    _loadCatalog();
  }

  Future<void> _loadCatalog() async {
    final repo = PersonFacilityRolesCatalogRepository();
    try {
      final roles = await repo.listActive();
      if (!mounted) return;
      setState(() {
        _catalog = roles.isEmpty
            ? [
                for (final e in PersonFacilityRoleCodes.fallbackNames.entries)
                  PersonFacilityRoleCatalogEntry(code: e.key, name: e.value),
              ]
            : roles;
        _loadingCatalog = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _catalog = [
          for (final e in PersonFacilityRoleCodes.fallbackNames.entries)
            PersonFacilityRoleCatalogEntry(code: e.key, name: e.value),
        ];
        _loadingCatalog = false;
      });
    } finally {
      repo.dispose();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _specialtyCtrl.dispose();
    _crmCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
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
              'Novo médico',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _useApi
                  ? 'Preencha os dados básicos. O perfil será criado e vinculado a esta clínica.'
                  : 'Preencha os dados básicos. O perfil será associado após a confirmação.',
              style: const TextStyle(fontSize: 12.5, color: AppColors.gray500),
            ),
            const SizedBox(height: 16),
            _field(_nameCtrl, 'Nome completo', TextInputType.name),
            const SizedBox(height: 10),
            _field(_specialtyCtrl, 'Especialidade', TextInputType.text),
            const SizedBox(height: 10),
            _field(_crmCtrl, 'CRM', TextInputType.text),
            const SizedBox(height: 10),
            _field(_phoneCtrl, 'Telefone', TextInputType.phone),
            const SizedBox(height: 10),
            _field(_emailCtrl, 'E-mail', TextInputType.emailAddress),
            const SizedBox(height: 16),
            const Text(
              'FUNÇÕES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1,
                color: AppColors.gray500,
              ),
            ),
            const SizedBox(height: 4),
            if (_loadingCatalog)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
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
                selected: _selectedRoles,
                enabled: !_saving,
                onChanged: (next) => setState(() => _selectedRoles = next),
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
                  : const Text('Criar perfil'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    TextInputType type,
  ) {
    return TextField(
      controller: controller,
      keyboardType: type,
      textCapitalization:
          type == TextInputType.name || type == TextInputType.text
          ? TextCapitalization.words
          : TextCapitalization.none,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: AppColors.surfaceTertiary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.gray200),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.gray200),
        ),
      ),
    );
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Informe o nome do médico'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _saving = true);

    final specialty = _specialtyCtrl.text.trim().isEmpty
        ? null
        : _specialtyCtrl.text.trim();
    final crmRaw = _crmCtrl.text.trim().isEmpty ? null : _crmCtrl.text.trim();
    final phone = _phoneCtrl.text.trim().isEmpty
        ? null
        : _phoneCtrl.text.trim();
    final email = _emailCtrl.text.trim().isEmpty
        ? null
        : _emailCtrl.text.trim();
    final roleCodes = PersonFacilityRoleCodes.sortedList(_selectedRoles);

    try {
      if (!_useApi) {
        await Future<void>.delayed(const Duration(milliseconds: 450));
        if (!mounted) return;
        Navigator.of(context).pop(
          ProfessionalRoster(
            id: -DateTime.now().millisecondsSinceEpoch,
            name: name,
            initials: initialsFromName(name),
            hue: hueFromName(name),
            specialty: specialty,
            crm: crmRaw,
            phone: phone,
            email: email,
            roleCodes: roleCodes,
            roleBadge: roleCodes.contains(PersonFacilityRoleCodes.decisionMaker)
                ? 'DECISOR'
                : null,
          ),
        );
        return;
      }

      final names = splitPersonName(name);
      final crm = parseCrmField(crmRaw);
      final repo = FacilityAssociateRepository(widget.facilityId!);
      try {
        final doctor = await repo.createAndAssociateDoctor(
          firstName: names.firstName,
          lastName: names.lastName,
          specialty: specialty,
          crmNumber: crm.number,
          crmState: crm.state,
          phone: phone,
          email: email,
          roleCodes: roleCodes,
        );
        if (!mounted) return;
        Navigator.of(context).pop(doctor);
      } finally {
        repo.dispose();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is FacilityAssociateException
                ? (e.message ?? 'Falha ao criar médico')
                : 'Falha ao criar médico',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}
