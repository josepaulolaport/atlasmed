import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Invite-only draft name step. Vertical + manager zone come from the invite
/// wizard and are shown read-only — not re-entered here.
class InvitePatchNameForm extends StatefulWidget {
  const InvitePatchNameForm({
    super.key,
    this.initialName,
    required this.verticalId,
    required this.verticalName,
    required this.managerTerritoryId,
    required this.managerTerritoryName,
  });

  final String? initialName;
  final String verticalId;
  final String verticalName;
  final String managerTerritoryId;
  final String managerTerritoryName;

  static Future<TerritoryDraft?> show(
    BuildContext context, {
    String? initialName,
    required String verticalId,
    required String verticalName,
    required String managerTerritoryId,
    required String managerTerritoryName,
  }) {
    return Navigator.of(context).push<TerritoryDraft>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => InvitePatchNameForm(
          initialName: initialName,
          verticalId: verticalId,
          verticalName: verticalName,
          managerTerritoryId: managerTerritoryId,
          managerTerritoryName: managerTerritoryName,
        ),
      ),
    );
  }

  @override
  State<InvitePatchNameForm> createState() => _InvitePatchNameFormState();
}

class _InvitePatchNameFormState extends State<InvitePatchNameForm> {
  late final TextEditingController _nameController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialName ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  bool get _isValid => _nameController.text.trim().isNotEmpty;

  void _submit() {
    if (!_isValid) return;
    Navigator.of(context).pop(
      TerritoryDraft(
        name: _nameController.text.trim(),
        kind: TerritoryKind.repPatch,
        verticalId: widget.verticalId,
        managerTerritoryId: widget.managerTerritoryId,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: AppColors.gray950,
        title: Text(
          widget.initialName == null || widget.initialName!.isEmpty
              ? 'Nova área'
              : 'Nome da área',
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
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _ContextChip(
                        label: widget.verticalName,
                        icon: Icons.layers_outlined,
                      ),
                      _ContextChip(
                        label: widget.managerTerritoryName,
                        icon: Icons.map_outlined,
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Nome da área',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _nameController,
                    autofocus: true,
                    onChanged: (_) => setState(() {}),
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submit(),
                    decoration: const InputDecoration(
                      hintText: 'Ex.: Patch Centro',
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(12)),
                        borderSide: BorderSide(color: AppColors.gray200),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: FilledButton(
                onPressed: _isValid ? _submit : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.navyDeep,
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  widget.initialName == null || widget.initialName!.isEmpty
                      ? 'Continuar para o mapa'
                      : 'Salvar',
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

class _ContextChip extends StatelessWidget {
  const _ContextChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.navyDeep.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.navyDeep.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppColors.navyDeep),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.navyDeep,
            ),
          ),
        ],
      ),
    );
  }
}
