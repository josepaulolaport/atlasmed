import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/repository/domain/exceptions/unexpected_status_code_exception.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

typedef PurchaseRecurrenceSave =
    Future<void> Function(PurchaseRecurrenceCommand command);

class PurchaseRecurrenceForm extends StatefulWidget {
  const PurchaseRecurrenceForm({
    super.key,
    required this.onSave,
    this.initialValue,
    this.verticalId,
  });

  final PurchaseRecurrenceSave onSave;
  final PurchaseRecurrenceSnapshot? initialValue;

  /// Linha comercial for multi-profile clinics (API `verticalId`).
  final int? verticalId;

  @override
  State<PurchaseRecurrenceForm> createState() => _PurchaseRecurrenceFormState();
}

class _PurchaseRecurrenceFormState extends State<PurchaseRecurrenceForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _daysController;
  PurchaseProfile? _selection;
  bool _requiresExplicitChoice = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final current = widget.initialValue;
    _requiresExplicitChoice =
        current?.rawProfile != null && current?.profile == null;
    _selection = _requiresExplicitChoice
        ? null
        : current?.profile ?? PurchaseProfile.automatic;
    if (_selection == PurchaseProfile.custom) {
      _daysController = TextEditingController(
        text: current?.intervalDays.toString(),
      );
    } else {
      _daysController = TextEditingController();
    }
  }

  @override
  void dispose() {
    _daysController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving || _selection == null || !_formKey.currentState!.validate()) {
      return;
    }
    final selection = _selection!;
    final verticalId = widget.verticalId;
    final command = switch (selection) {
      PurchaseProfile.automatic => AutomaticPurchaseRecurrence(
        verticalId: verticalId,
      ),
      PurchaseProfile.custom => CustomPurchaseRecurrence(
        int.parse(_daysController.text),
        verticalId: verticalId,
      ),
      _ => PresetPurchaseRecurrence(selection, verticalId: verticalId),
    };
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSave(command);
    } catch (error) {
      if (!mounted) return;
      final forbidden =
          error is UnexpectedStatusCodeException &&
          error.received.statusCode == 403;
      setState(
        () => _error = forbidden
            ? 'Você não tem permissão para editar este perfil.'
            : 'Não foi possível salvar. Tente novamente.',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _profileTile(
    PurchaseProfile profile,
    String label, {
    String? subtitle,
  }) {
    final selected = _selection == profile;
    return ListTile(
      enabled: !_saving,
      leading: Icon(
        selected ? Icons.radio_button_checked : Icons.radio_button_off,
        color: selected ? Theme.of(context).colorScheme.primary : null,
      ),
      title: Text(label),
      subtitle: subtitle == null ? null : Text(subtitle),
      onTap: _saving
          ? null
          : () => setState(() {
              _selection = profile;
              _requiresExplicitChoice = false;
            }),
    );
  }

  @override
  Widget build(BuildContext context) {
    const presets = [
      PurchaseProfile.weekly,
      PurchaseProfile.biweekly,
      PurchaseProfile.monthly,
      PurchaseProfile.bimonthly,
      PurchaseProfile.quarterly,
      PurchaseProfile.semiannual,
      PurchaseProfile.annual,
    ];
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_requiresExplicitChoice)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Text(
                'O perfil recebido não é reconhecido. Escolha explicitamente um perfil para salvar sem perder o valor atual.',
                style: TextStyle(color: AppColors.amberDark),
              ),
            ),
          _profileTile(
            PurchaseProfile.automatic,
            'Automático',
            subtitle: 'Usar o intervalo calculado pelas compras',
          ),
          for (final profile in presets)
            _profileTile(profile, profile.optionLabel),
          _profileTile(PurchaseProfile.custom, 'Personalizado'),
          if (_selection == PurchaseProfile.custom)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextFormField(
                controller: _daysController,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  labelText: 'Intervalo em dias',
                ),
                validator: (value) {
                  final days = int.tryParse(value ?? '');
                  return days == null || days < 1 || days > 3650
                      ? 'Informe de 1 a 3650 dias'
                      : null;
                },
              ),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.redDark),
              ),
            ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: FilledButton(
              onPressed: _saving || _selection == null ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Salvar'),
            ),
          ),
        ],
      ),
    );
  }
}
