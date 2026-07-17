import 'package:atlasmed_mobile_app/features/territories/data/models/sector.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/manager_picker_field.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/sector_selector.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/territory_kind_switch.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Full-screen form collecting a new territory's metadata (name, kind,
/// sector, parent manager zone) before/while it's being drawn in the
/// geometry editor. Pushed as a dialog route and resolved with the
/// [TerritoryDraft] the user confirmed, or `null` if they backed out.
///
/// Assignment (who the territory reports to/is staffed by) is a separate,
/// post-creation action — see `UserPickerSheet.pickAssignee` — so this
/// form no longer collects a free-text "responsável" name.
class TerritoryMetadataForm extends ConsumerStatefulWidget {
  final TerritoryDraft? initial;
  final TerritoryKind initialKind;
  final String? initialSectorId;

  const TerritoryMetadataForm({
    super.key,
    this.initial,
    required this.initialKind,
    required this.initialSectorId,
  });

  static Future<TerritoryDraft?> show(
    BuildContext context, {
    TerritoryDraft? initial,
    required TerritoryKind initialKind,
    required String? initialSectorId,
  }) {
    return Navigator.of(context).push<TerritoryDraft>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryMetadataForm(
          initial: initial,
          initialKind: initialKind,
          initialSectorId: initialSectorId,
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
  String? _sectorId;
  String? _managerTerritoryId;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _nameController = TextEditingController(text: initial?.name ?? '');
    _kind = initial?.kind ?? widget.initialKind;
    _sectorId = initial?.sectorId ?? widget.initialSectorId;
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
      _sectorId != null &&
      (!_isPatch || _managerTerritoryId != null);

  void _submit() {
    if (!_isValid) return;
    Navigator.of(context).pop(
      TerritoryDraft(
        name: _nameController.text.trim(),
        kind: _kind,
        sectorId: _sectorId!,
        managerTerritoryId: _isPatch ? _managerTerritoryId : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sectorsAsync = ref.watch(sectorsProvider);

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
      body: sectorsAsync.when(
        data: (sectors) => _buildForm(sectors),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) =>
            const Center(child: Text('Não foi possível carregar os setores.')),
      ),
    );
  }

  Widget _buildForm(List<Sector> sectors) {
    return SafeArea(
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
                const SizedBox(height: 20),
                const _FieldLabel('Setor'),
                const SizedBox(height: 6),
                SectorSelector(
                  sectors: sectors,
                  selectedSectorId: _sectorId,
                  onChanged: (sectorId) {
                    if (sectorId == _sectorId) return;
                    setState(() {
                      _sectorId = sectorId;
                      _managerTerritoryId = null;
                    });
                  },
                ),
                if (_isPatch) ...[
                  const SizedBox(height: 20),
                  const _FieldLabel('Zona de gerente'),
                  const SizedBox(height: 6),
                  ManagerPickerField(
                    sectorId: _sectorId,
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
