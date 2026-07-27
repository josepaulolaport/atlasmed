import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/facility_associate_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Create a doctor profile. When [facilityId] is a real facility, persists via
/// `POST /professionals` (with facility link) + optional role PATCH.
Future<ProfessionalRoster?> showCreateDoctorProfileSheet(
  BuildContext context, {
  String? facilityId,
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

  final String? facilityId;

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
  bool _prescriber = true;
  bool _decisionMaker = false;
  bool _buyer = false;
  bool _saving = false;

  bool get _useApi {
    final id = widget.facilityId;
    if (id == null || id.isEmpty) return false;
    return !id.startsWith('near-') && !id.endsWith(':empty');
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
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('Prescritor'),
                  selected: _prescriber,
                  onSelected: (v) => setState(() => _prescriber = v),
                ),
                FilterChip(
                  label: const Text('Decisor'),
                  selected: _decisionMaker,
                  onSelected: (v) => setState(() => _decisionMaker = v),
                ),
                FilterChip(
                  label: const Text('Comprador'),
                  selected: _buyer,
                  onSelected: (v) => setState(() => _buyer = v),
                ),
              ],
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _saving ? null : _save,
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

    try {
      if (!_useApi) {
        await Future<void>.delayed(const Duration(milliseconds: 450));
        if (!mounted) return;
        Navigator.of(context).pop(
          ProfessionalRoster(
            id: 'new-doc-${DateTime.now().millisecondsSinceEpoch}',
            name: name,
            initials: initialsFromName(name),
            hue: hueFromName(name),
            specialty: specialty,
            crm: crmRaw,
            phone: phone,
            email: email,
            isPrescriber: _prescriber,
            isDecisionMaker: _decisionMaker,
            isBuyer: _buyer,
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
          isPrescriber: _prescriber,
          isBuyer: _buyer,
          isDecisionMaker: _decisionMaker,
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
