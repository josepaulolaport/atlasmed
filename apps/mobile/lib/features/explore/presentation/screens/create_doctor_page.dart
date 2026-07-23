import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/professionals_write_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/relationship_stars.dart';

const _kUfOptions = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

class CreateDoctorPage extends ConsumerStatefulWidget {
  const CreateDoctorPage({super.key, this.facilityId});

  final String? facilityId;

  @override
  ConsumerState<CreateDoctorPage> createState() => _CreateDoctorPageState();
}

class _CreateDoctorPageState extends ConsumerState<CreateDoctorPage> {
  final _nameCtrl = TextEditingController();
  final _specialtyCtrl = TextEditingController();
  final _crmCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _whatsappCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();

  String? _crmState;
  int? _relationshipLevel;
  bool _prescriber = true;
  bool _decisionMaker = false;
  bool _buyer = false;
  bool _saving = false;

  bool get _hasFacility {
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
    _whatsappCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(4, top + 4, 8, 8),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  onPressed: () => context.pop(),
                ),
                const Expanded(
                  child: Text(
                    'Novo médico',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
              children: [
                Text(
                  _hasFacility
                      ? 'Preencha os dados. O perfil será criado e vinculado a esta clínica.'
                      : 'Preencha os dados para criar o perfil do médico.',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF6b7280),
                  ),
                ),
                const SizedBox(height: 16),
                _field(_nameCtrl, 'Nome completo *', TextInputType.name),
                const SizedBox(height: 10),
                _field(_specialtyCtrl, 'Especialidade', TextInputType.text),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: _field(_crmCtrl, 'CRM', TextInputType.text),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: _ufField()),
                  ],
                ),
                const SizedBox(height: 10),
                _field(_phoneCtrl, 'Telefone', TextInputType.phone),
                const SizedBox(height: 10),
                _field(_whatsappCtrl, 'WhatsApp', TextInputType.phone),
                const SizedBox(height: 10),
                _field(_emailCtrl, 'E-mail', TextInputType.emailAddress),
                const SizedBox(height: 14),
                RelationshipLevelPicker(
                  value: _relationshipLevel,
                  onChanged: (v) => setState(() => _relationshipLevel = v),
                ),
                if (_hasFacility) ...[
                  const SizedBox(height: 14),
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
                ],
                const SizedBox(height: 24),
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
                      : Text(
                          _hasFacility ? 'Criar e vincular' : 'Criar médico',
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _decoration(String label) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFe5e7eb)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFe5e7eb)),
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
      decoration: _decoration(label),
    );
  }

  Widget _ufField() {
    final selected = _crmState;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: _pickUf,
      child: InputDecorator(
        decoration: _decoration('UF').copyWith(
          suffixIcon: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: Color(0xFF6b7280),
          ),
        ),
        child: Text(
          selected ?? 'Selecione',
          style: TextStyle(
            fontSize: 16,
            color: selected == null
                ? const Color(0xFF9ca3af)
                : const Color(0xFF0f1729),
          ),
        ),
      ),
    );
  }

  Future<void> _pickUf() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
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
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'UF do CRM',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0f1729),
                        ),
                      ),
                    ),
                    if (_crmState != null)
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(''),
                        child: const Text('Limpar'),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 5,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 1.4,
                  children: _kUfOptions.map((uf) {
                    final selected = uf == _crmState;
                    return Material(
                      color: selected
                          ? const Color(0xFF1e40af)
                          : const Color(0xFFf3f4f6),
                      borderRadius: BorderRadius.circular(10),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () => Navigator.of(context).pop(uf),
                        child: Center(
                          child: Text(
                            uf,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: selected
                                  ? Colors.white
                                  : const Color(0xFF0f1729),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (!mounted || picked == null) return;
    setState(() => _crmState = picked.isEmpty ? null : picked);
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      _snack('Informe o nome do médico');
      return;
    }

    final email = _emailCtrl.text.trim();
    if (email.isNotEmpty && !email.contains('@')) {
      _snack('E-mail inválido');
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
    final whatsapp = _whatsappCtrl.text.trim().isEmpty
        ? null
        : _whatsappCtrl.text.trim();
    final emailValue = email.isEmpty ? null : email;

    final names = splitPersonName(name);
    final crm = parseCrmField(crmRaw);
    final crmNumber = crm.number;
    final crmState = _crmState ?? crm.state;

    final repo = ProfessionalsWriteRepository();
    try {
      final doctor = await repo.createDoctor(
        firstName: names.firstName,
        lastName: names.lastName,
        specialty: specialty,
        crmNumber: crmNumber,
        crmState: crmState,
        phone: phone,
        whatsappNumber: whatsapp,
        email: emailValue,
        facilityId: _hasFacility ? widget.facilityId : null,
        relationshipLevel: _relationshipLevel,
        isPrescriber: _hasFacility ? _prescriber : false,
        isBuyer: _hasFacility ? _buyer : false,
        isDecisionMaker: _hasFacility ? _decisionMaker : false,
      );

      await ref.read(exploreProvider.notifier).loadData();
      if (!mounted) return;

      if (_hasFacility) {
        context.pop(doctor);
      } else {
        context.pushReplacement('/workspace/doctor/${doctor.id}');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      _snack(
        e is ProfessionalsWriteException
            ? (e.message ?? 'Falha ao criar médico')
            : 'Falha ao criar médico',
      );
    } finally {
      repo.dispose();
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }
}
