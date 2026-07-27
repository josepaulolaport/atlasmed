import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Create or edit an administrative professional.
///
/// Real [facilityId] → `POST` / `PATCH /facilities/:id/representatives`.
Future<AdministrativeProfessional?> showCreateAdminProfessionalSheet(
  BuildContext context, {
  String? facilityId,
  AdministrativeProfessional? existing,
}) {
  return showModalBottomSheet<AdministrativeProfessional>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _CreateAdminProfessionalSheet(
      facilityId: facilityId,
      existing: existing,
    ),
  );
}

class _CreateAdminProfessionalSheet extends StatefulWidget {
  const _CreateAdminProfessionalSheet({this.facilityId, this.existing});

  final String? facilityId;
  final AdministrativeProfessional? existing;

  @override
  State<_CreateAdminProfessionalSheet> createState() =>
      _CreateAdminProfessionalSheetState();
}

class _CreateAdminProfessionalSheetState
    extends State<_CreateAdminProfessionalSheet> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _roleCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _emailCtrl;
  late bool _isPartner;
  late bool _isAdministrator;
  late bool _isDecisionMaker;
  late bool _isBuyer;
  late bool _isBiller;
  late bool _isSecretary;
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  bool get _useApi {
    final id = widget.facilityId;
    if (id == null || id.isEmpty) return false;
    return !id.startsWith('near-') && !id.endsWith(':empty');
  }

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _nameCtrl = TextEditingController(text: existing?.name ?? '');
    _roleCtrl = TextEditingController(text: existing?.roleTitle ?? '');
    _phoneCtrl = TextEditingController(text: existing?.phone ?? '');
    _emailCtrl = TextEditingController(text: existing?.email ?? '');
    _isPartner = existing?.isPartner ?? false;
    _isAdministrator = existing?.isAdministrator ?? false;
    _isDecisionMaker = existing?.isDecisionMaker ?? false;
    _isBuyer = existing?.isBuyer ?? false;
    _isBiller = existing?.isBiller ?? false;
    _isSecretary = existing?.isSecretary ?? false;
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
                  color: const AppColors.gray200,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            Text(
              _isEdit
                  ? 'Editar profissional administrativo'
                  : 'Novo profissional administrativo',
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 4),
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
            _roleToggle('Sócio', _isPartner, (v) => _isPartner = v),
            _roleToggle(
              'Administrador',
              _isAdministrator,
              (v) => _isAdministrator = v,
            ),
            _roleToggle(
              'Decisor',
              _isDecisionMaker,
              (v) => _isDecisionMaker = v,
            ),
            _roleToggle('Comprador', _isBuyer, (v) => _isBuyer = v),
            _roleToggle('Faturista', _isBiller, (v) => _isBiller = v),
            _roleToggle('Secretária', _isSecretary, (v) => _isSecretary = v),
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
                  : Text(_isEdit ? 'Salvar' : 'Criar perfil'),
            ),
          ],
        ),
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
        fillColor: const AppColors.surfaceTertiary,
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

    try {
      if (!_useApi) {
        await Future<void>.delayed(const Duration(milliseconds: 450));
        if (!mounted) return;
        Navigator.of(context).pop(
          AdministrativeProfessional(
            id:
                widget.existing?.id ??
                'new-adm-${DateTime.now().millisecondsSinceEpoch}',
            name: name,
            roleTitle: roleTitle,
            phone: phone,
            email: email,
            isPartner: _isPartner,
            isAdministrator: _isAdministrator,
            isDecisionMaker: _isDecisionMaker,
            isBuyer: _isBuyer,
            isBiller: _isBiller,
            isSecretary: _isSecretary,
            relationshipScore: widget.existing?.relationshipScore,
          ),
        );
        return;
      }

      final repo = FacilityRepresentativesRepository(widget.facilityId!);
      try {
        final AdministrativeProfessional saved;
        if (_isEdit) {
          saved = await repo.updateRepresentative(
            representativeId: widget.existing!.id,
            representativeName: name,
            roleTitle: roleTitle ?? '',
            phone: phone ?? '',
            email: email ?? '',
            isPartner: _isPartner,
            isAdministrator: _isAdministrator,
            isDecisionMaker: _isDecisionMaker,
            isBuyer: _isBuyer,
            isBiller: _isBiller,
            isSecretary: _isSecretary,
          );
        } else {
          saved = await repo.create(
            representativeName: name,
            roleTitle: roleTitle,
            phone: phone,
            email: email,
            isPartner: _isPartner,
            isAdministrator: _isAdministrator,
            isDecisionMaker: _isDecisionMaker,
            isBuyer: _isBuyer,
            isBiller: _isBiller,
            isSecretary: _isSecretary,
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
