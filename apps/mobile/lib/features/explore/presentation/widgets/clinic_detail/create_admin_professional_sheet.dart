import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';

/// Create an administrative professional. When [facilityId] is real, persists
/// via `POST /facilities/:id/representatives`.
Future<AdministrativeProfessional?> showCreateAdminProfessionalSheet(
  BuildContext context, {
  String? facilityId,
}) {
  return showModalBottomSheet<AdministrativeProfessional>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _CreateAdminProfessionalSheet(facilityId: facilityId),
  );
}

class _CreateAdminProfessionalSheet extends StatefulWidget {
  const _CreateAdminProfessionalSheet({this.facilityId});

  final String? facilityId;

  @override
  State<_CreateAdminProfessionalSheet> createState() =>
      _CreateAdminProfessionalSheetState();
}

class _CreateAdminProfessionalSheetState
    extends State<_CreateAdminProfessionalSheet> {
  final _nameCtrl = TextEditingController();
  final _roleCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  String _contactType = 'PROFESSIONAL';
  bool _saving = false;

  bool get _useApi {
    final id = widget.facilityId;
    if (id == null || id.isEmpty) return false;
    return !id.startsWith('near-') && !id.endsWith(':empty');
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
                  color: const Color(0xFFe5e7eb),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const Text(
              'Novo profissional administrativo',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _useApi
                  ? 'Preencha os dados de contato. O perfil será criado nesta clínica.'
                  : 'Preencha os dados de contato. O perfil será associado após a confirmação.',
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF6b7280)),
            ),
            const SizedBox(height: 16),
            _field(_nameCtrl, 'Nome completo', TextInputType.name),
            const SizedBox(height: 10),
            _field(_roleCtrl, 'Cargo', TextInputType.text),
            const SizedBox(height: 10),
            _field(_phoneCtrl, 'Telefone', TextInputType.phone),
            const SizedBox(height: 10),
            _field(_emailCtrl, 'E-mail', TextInputType.emailAddress),
            const SizedBox(height: 12),
            const Text(
              'Tipo de contato',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6b7280),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                for (final (value, label) in const [
                  ('DECISOR', 'Decisor'),
                  ('COMPRADOR', 'Comprador'),
                  ('PROFESSIONAL', 'Profissional'),
                ])
                  ChoiceChip(
                    label: Text(label),
                    selected: _contactType == value,
                    onSelected: (_) => setState(() => _contactType = value),
                  ),
              ],
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF1e40af),
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
        fillColor: const Color(0xFFf8f9fb),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFe5e7eb)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFe5e7eb)),
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
            id: 'new-adm-${DateTime.now().millisecondsSinceEpoch}',
            name: name,
            roleTitle: roleTitle,
            phone: phone,
            email: email,
            contactType: _contactType,
          ),
        );
        return;
      }

      final repo = FacilityRepresentativesRepository(widget.facilityId!);
      try {
        final created = await repo.create(
          representativeName: name,
          roleTitle: roleTitle,
          phone: phone,
          email: email,
          contactType: _contactType,
        );
        if (!mounted) return;
        Navigator.of(context).pop(created);
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
                ? (e.message ?? 'Falha ao criar profissional')
                : 'Falha ao criar profissional',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}
