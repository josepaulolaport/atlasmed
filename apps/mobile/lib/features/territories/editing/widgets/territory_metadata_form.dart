import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/manager_picker_field.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/territory_kind_switch.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class TerritoryMetadataForm extends ConsumerStatefulWidget {
  final TerritoryDraft? initial;
  final TerritoryKind initialKind;

  const TerritoryMetadataForm({
    super.key,
    this.initial,
    required this.initialKind,
  });

  static Future<TerritoryDraft?> show(
    BuildContext context, {
    TerritoryDraft? initial,
    required TerritoryKind initialKind,
  }) {
    return Navigator.of(context).push<TerritoryDraft>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryMetadataForm(
          initial: initial,
          initialKind: initialKind,
        ),
      ),
    );
  }

  @override
  ConsumerState<TerritoryMetadataForm> createState() =>
      _TerritoryMetadataFormState();
}

class _TerritoryMetadataFormState extends ConsumerState<TerritoryMetadataForm> {
  late final TextEditingController _nameController;
  late TerritoryKind _kind;
  String? _managerTerritoryId;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _nameController = TextEditingController(text: initial?.name ?? '');
    _kind = initial?.kind ?? widget.initialKind;
    _managerTerritoryId = initial?.managerTerritoryId;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  bool get _isPatch => _kind == TerritoryKind.repPatch;

  bool get _isValid =>
      _nameController.text.trim().isNotEmpty &&
      (!_isPatch || _managerTerritoryId != null);

  void _submit() {
    if (!_isValid) return;
    Navigator.of(context).pop(
      TerritoryDraft(
        name: _nameController.text.trim(),
        kind: _kind,
        managerTerritoryId: _isPatch ? _managerTerritoryId : null,
      ),
    );
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
        title: Text(
          widget.initial == null ? 'Novo território' : 'Editar informações',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
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
                  const SizedBox(height: 20),
                  const _FieldLabel('Tipo'),
                  const SizedBox(height: 6),
                  TerritoryKindSwitch(
                    value: _kind,
                    onChanged: (kind) {
                      if (kind == _kind) return;
                      setState(() {
                        _kind = kind;
                        if (kind == TerritoryKind.managerZone) {
                          _managerTerritoryId = null;
                        }
                      });
                    },
                  ),
                  if (_isPatch) ...[
                    const SizedBox(height: 20),
                    const _FieldLabel('Zona de gerente'),
                    const SizedBox(height: 6),
                    ManagerPickerField(
                      managerTerritoryId: _managerTerritoryId,
                      onChanged: (zoneId) =>
                          setState(() => _managerTerritoryId = zoneId),
                    ),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: FilledButton(
                onPressed: _isValid ? _submit : null,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0a2f7f),
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  widget.initial == null ? 'Continuar para o mapa' : 'Salvar',
                  style: const TextStyle(
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
