import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_api_exception.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/manager_picker_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class TerritoryInfoForm extends ConsumerStatefulWidget {
  final Territory territory;

  const TerritoryInfoForm({super.key, required this.territory});

  static Future<bool> show(BuildContext context, Territory territory) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryInfoForm(territory: territory),
      ),
    );
    return saved ?? false;
  }

  @override
  ConsumerState<TerritoryInfoForm> createState() => _TerritoryInfoFormState();
}

class _TerritoryInfoFormState extends ConsumerState<TerritoryInfoForm> {
  late final TextEditingController _nameController;
  late bool _isActive;
  String? _managerTerritoryId;
  bool _saving = false;

  bool get _isPatch => widget.territory.kind == TerritoryKind.repPatch;

  @override
  void initState() {
    super.initState();
    final territory = widget.territory;
    _nameController = TextEditingController(text: territory.name);
    _isActive = territory.isActive;
    _managerTerritoryId = territory.managerTerritoryId;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  bool get _isValid =>
      _nameController.text.trim().isNotEmpty &&
      (!_isPatch || _managerTerritoryId != null);

  Future<void> _submit() async {
    if (!_isValid || _saving) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(territoryRepositoryProvider)
          .updateTerritoryInfo(
            widget.territory.id,
            name: _nameController.text.trim(),
            isActive: _isActive,
            managerTerritoryId: _isPatch ? _managerTerritoryId : null,
          );
      ref.invalidate(territoriesProvider);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is TerritoryApiException
                ? error.message
                : 'Não foi possível salvar. Tente novamente.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF7F8FB),
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: const Color(0xFF111827),
        title: const Text(
          'Editar informações',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                children: [
                  const _FieldLabel('Nome do território'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _nameController,
                    onChanged: (_) => setState(() {}),
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(
                      hintText: 'Ex.: Zona Oncologia Norte',
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(12)),
                        borderSide: BorderSide(color: Color(0xFFE1E4EA)),
                      ),
                    ),
                  ),
                  if (_isPatch) ...[
                    const SizedBox(height: 20),
                    const _FieldLabel('Zona de gerente'),
                    const SizedBox(height: 6),
                    ManagerPickerField(
                      managerTerritoryId: _managerTerritoryId,
                      verticalId: widget.territory.verticalId,
                      onChanged: (zoneId) =>
                          setState(() => _managerTerritoryId = zoneId),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE1E4EA)),
                    ),
                    child: Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Território ativo',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF111827),
                            ),
                          ),
                        ),
                        Switch(
                          value: _isActive,
                          activeThumbColor: const Color(0xFF0a2f7f),
                          onChanged: (value) =>
                              setState(() => _isActive = value),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: FilledButton(
                onPressed: _isValid && !_saving ? _submit : null,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0a2f7f),
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
                    : const Text(
                        'Salvar',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14.5,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;

  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w700,
        color: Color(0xFF374151),
      ),
    );
  }
}
