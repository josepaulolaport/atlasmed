import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/person_facility_roles_catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/person_facility_role_toggles.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Create or edit an administrative professional.
///
/// Real [facilityId] → `POST` / `PATCH /facilities/:id/administrative-contacts`.
///
/// A pushed screen rather than a bottom sheet. The form is four fields plus a
/// toggle per role — eight of them today, and the catalogue grows — so the
/// sheet was already taller than the screen: its title sat under the status bar
/// and collided with the Dynamic Island, and there was no room left to give it
/// a safe area without shrinking the form further. A full route has a real app
/// bar, its own back affordance, and as much height as the content needs.
Future<AdministrativeProfessional?> openCreateAdminProfessionalScreen(
  BuildContext context, {
  int? facilityId,
  AdministrativeProfessional? existing,
}) {
  return Navigator.of(
    context,
    rootNavigator: true,
  ).push<AdministrativeProfessional>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => CreateAdminProfessionalScreen(
        facilityId: facilityId,
        existing: existing,
      ),
    ),
  );
}

/// Public so a widget test can mount it without a route.
@visibleForTesting
class CreateAdminProfessionalScreen extends StatefulWidget {
  const CreateAdminProfessionalScreen({
    super.key,
    this.facilityId,
    this.existing,
  });

  final int? facilityId;
  final AdministrativeProfessional? existing;

  @override
  State<CreateAdminProfessionalScreen> createState() =>
      _CreateAdminProfessionalScreenState();
}

class _CreateAdminProfessionalScreenState
    extends State<CreateAdminProfessionalScreen> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _roleCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _emailCtrl;
  late Set<int> _selectedRoles;
  List<PersonFacilityRoleCatalogEntry> _catalog = const [];
  bool _loadingCatalog = true;
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  bool get _useApi {
    final id = widget.facilityId;
    return id != null && id > 0;
  }

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _nameCtrl = TextEditingController(text: existing?.name ?? '');
    _roleCtrl = TextEditingController(text: existing?.roleTitle ?? '');
    _phoneCtrl = TextEditingController(text: existing?.phone ?? '');
    _emailCtrl = TextEditingController(text: existing?.email ?? '');
    _selectedRoles = {...?existing?.roleIds};
    _loadCatalog();
  }

  Future<void> _loadCatalog() async {
    final repo = PersonFacilityRolesCatalogRepository();
    try {
      final roles = await repo.listActive();
      if (!mounted) return;
      setState(() {
        _catalog = roles;
        _loadingCatalog = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _catalog = const [];
        _loadingCatalog = false;
      });
    } finally {
      repo.dispose();
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _roleCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      // The title lives here now, where the app bar keeps it clear of the
      // status bar instead of tucking it under the Dynamic Island.
      appBar: AppBar(
        title: Text(_isEdit ? 'Editar profissional' : 'Novo profissional'),
        backgroundColor: Colors.white,
      ),
      body: _body(context),
      // Pinned rather than scrolled past: on a catalogue of eight roles the
      // button used to sit below the fold, so the form had to be scrolled to
      // its end before it could be submitted.
      bottomNavigationBar: _saveBar(context),
    );
  }

  Widget _body(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              _isEdit
                  ? 'Atualize os dados e as funções deste contato.'
                  : _useApi
                  ? 'Preencha os dados de contato. O perfil será criado nesta clínica.'
                  : 'Preencha os dados de contato. O perfil será associado após a confirmação.',
              style: const TextStyle(fontSize: 12.5, color: AppColors.gray500),
            ),
            const SizedBox(height: 16),
            _field(_nameCtrl, 'Nome completo', TextInputType.name),
            const SizedBox(height: 10),
            _field(_roleCtrl, 'Cargo', TextInputType.text),
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
          ],
        ),
      ),
    );
  }

  Widget _saveBar(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        // Rides above the keyboard, so the button stays reachable while a
        // field is focused.
        padding: EdgeInsets.fromLTRB(
          20,
          8,
          20,
          12 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: FilledButton(
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
              : Text(_isEdit ? 'Salvar' : 'Criar perfil'),
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
          content: Text('Informe o nome do profissional'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _saving = true);

    final roleTitle = _roleCtrl.text.trim().isEmpty
        ? null
        : _roleCtrl.text.trim();
    final phone = _phoneCtrl.text.trim().isEmpty
        ? null
        : _phoneCtrl.text.trim();
    final email = _emailCtrl.text.trim().isEmpty
        ? null
        : _emailCtrl.text.trim();
    final roleIds = PersonFacilityRoleCatalog.sortedIds(_selectedRoles);

    try {
      if (!_useApi) {
        await Future<void>.delayed(const Duration(milliseconds: 450));
        if (!mounted) return;
        Navigator.of(context).pop(
          AdministrativeProfessional(
            id: widget.existing?.id ?? -DateTime.now().millisecondsSinceEpoch,
            name: name,
            roleTitle: roleTitle,
            phone: phone,
            email: email,
            roleIds: roleIds,
            relationshipScore: widget.existing?.relationshipScore,
          ),
        );
        return;
      }

      final names = splitPersonName(name);
      final repo = FacilityRepresentativesRepository(widget.facilityId!);
      try {
        final AdministrativeProfessional saved;
        if (_isEdit) {
          saved = await repo.updateRepresentative(
            representativeId: widget.existing!.id,
            firstName: names.firstName,
            lastName: names.lastName,
            roleTitle: roleTitle ?? '',
            mobilePhone: phone ?? '',
            email: email ?? '',
            roleIds: roleIds,
          );
        } else {
          saved = await repo.create(
            firstName: names.firstName,
            lastName: names.lastName,
            roleTitle: roleTitle,
            mobilePhone: phone,
            email: email,
            roleIds: roleIds,
          );
        }
        if (!mounted) return;
        Navigator.of(context).pop(saved);
      } finally {
        repo.dispose();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is FacilityRepresentativesException
                ? (e.message ?? 'Falha ao salvar profissional')
                : 'Falha ao salvar profissional',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}
