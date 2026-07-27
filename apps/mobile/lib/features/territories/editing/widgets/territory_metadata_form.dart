import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/manager_picker_field.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/territory_kind_switch.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/vertical_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class TerritoryMetadataForm extends ConsumerStatefulWidget {
  final TerritoryDraft? initial;
  final TerritoryKind initialKind;
  final String? initialVerticalId;

  const TerritoryMetadataForm({
    super.key,
    this.initial,
    required this.initialKind,
    this.initialVerticalId,
  });

  static Future<TerritoryDraft?> show(
    BuildContext context, {
    TerritoryDraft? initial,
    required TerritoryKind initialKind,
    String? initialVerticalId,
  }) {
    return Navigator.of(context).push<TerritoryDraft>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryMetadataForm(
          initial: initial,
          initialKind: initialKind,
          initialVerticalId: initialVerticalId,
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
  String? _verticalId;
  String? _managerTerritoryId;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _nameController = TextEditingController(text: initial?.name ?? '');
    _kind = initial?.kind ?? widget.initialKind;
    _verticalId = initial?.verticalId ?? widget.initialVerticalId;
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
      _verticalId != null &&
      (!_isPatch || _managerTerritoryId != null);

  void _setVertical(String? verticalId) {
    if (verticalId == _verticalId) return;
    setState(() {
      _verticalId = verticalId;
      _managerTerritoryId = null;
    });
  }

  void _submit() {
    if (!_isValid) return;
    Navigator.of(context).pop(
      TerritoryDraft(
        name: _nameController.text.trim(),
        kind: _kind,
        verticalId: _verticalId!,
        managerTerritoryId: _isPatch ? _managerTerritoryId : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const AppColors.background,
      appBar: AppBar(
        backgroundColor: const AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: const AppColors.gray950,
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
                        borderSide: BorderSide(color: AppColors.gray200),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const _FieldLabel('Vertical de negócio'),
                  const SizedBox(height: 6),
                  _VerticalPicker(
                    selectedVerticalId: _verticalId,
                    onChanged: _setVertical,
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
                      verticalId: _verticalId,
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
                  backgroundColor: const AppColors.navyDeep,
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

class _VerticalPicker extends ConsumerWidget {
  final String? selectedVerticalId;
  final ValueChanged<String?> onChanged;

  const _VerticalPicker({
    required this.selectedVerticalId,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verticalsAsync = ref.watch(businessVerticalsProvider);
    return verticalsAsync.when(
      loading: () => const _FormBox(
        child: Row(
          children: [
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 10),
            Text('Carregando verticais...'),
          ],
        ),
      ),
      error: (_, _) => _FormBox(
        child: Row(
          children: [
            const Expanded(
              child: Text('Não foi possível carregar os verticais.'),
            ),
            TextButton(
              onPressed: () => ref.invalidate(businessVerticalsProvider),
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
      data: (verticals) {
        if (verticals.isEmpty) {
          return const _FormBox(
            child: Text('Nenhum vertical disponível para criação.'),
          );
        }
        return VerticalSelector(
          verticals: verticals,
          selectedVerticalId: selectedVerticalId,
          onChanged: onChanged,
        );
      },
    );
  }
}

class _FormBox extends StatelessWidget {
  final Widget child;

  const _FormBox({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const AppColors.gray200),
      ),
      child: child,
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
        color: AppColors.gray700,
      ),
    );
  }
}
