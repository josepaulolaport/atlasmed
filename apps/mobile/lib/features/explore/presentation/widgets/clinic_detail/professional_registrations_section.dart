import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_registration.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/person_professional_registration_councils_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/person_professional_registrations_repository.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

final _councilsRepositoryProvider =
    Provider<PersonProfessionalRegistrationCouncilsRepository>((ref) {
      return PersonProfessionalRegistrationCouncilsRepository();
    });

PersonProfessionalRegistrationsRepository _regsRepo(int personId) =>
    PersonProfessionalRegistrationsRepository(personId);

Future<void> showProfessionalRegistrationSheet(
  BuildContext context, {
  required int personId,
  required PersonProfessionalRegistrationsRepository repository,
  required WidgetRef ref,
  ProfessionalRegistration? existing,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _RegistrationSheet(
      personId: personId,
      repository: repository,
      existing: existing,
      ref: ref,
    ),
  );
}

class ProfessionalRegistrationsSection extends ConsumerWidget {
  const ProfessionalRegistrationsSection({
    super.key,
    required this.personId,
    this.onChanged,
  });

  final int personId;
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repository = _regsRepo(personId);
    return RepositoryBuilder(
      repository: repository,
      builder: (context, regs, repo) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 12, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'REGISTROS PROFISSIONAIS',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.4,
                        color: AppColors.gray400,
                      ),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      await showProfessionalRegistrationSheet(
                        context,
                        personId: personId,
                        repository: repo,
                        ref: ref,
                      );
                      onChanged?.call();
                    },
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Adicionar'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            if (regs == null || regs.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20),
                child: Text(
                  'Nenhum registro cadastrado.',
                  style: TextStyle(fontSize: 13, color: AppColors.gray500),
                ),
              )
            else
              ...regs.map(
                (reg) => _RegistrationTile(
                  registration: reg,
                  onEdit: () async {
                    await showProfessionalRegistrationSheet(
                      context,
                      personId: personId,
                      repository: repo,
                      ref: ref,
                      existing: reg,
                    );
                    onChanged?.call();
                  },
                  onDeactivate: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Desativar registro?'),
                        content: Text(
                          'Desativar ${reg.displayLabel}? Você poderá cadastrar outro registro depois.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: const Text('Cancelar'),
                          ),
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            child: const Text('Desativar'),
                          ),
                        ],
                      ),
                    );
                    if (ok != true) return;
                    try {
                      await repo.deactivate(reg.id);
                      onChanged?.call();
                    } catch (e) {
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('$e')),
                      );
                    }
                  },
                ),
              ),
          ],
        );
      },
    );
  }
}

class _RegistrationTile extends StatelessWidget {
  const _RegistrationTile({
    required this.registration,
    required this.onEdit,
    required this.onDeactivate,
  });

  final ProfessionalRegistration registration;
  final VoidCallback onEdit;
  final VoidCallback onDeactivate;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Material(
        color: AppColors.surfaceSecondary.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 4,
          ),
          title: Text(
            registration.displayLabel,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.gray900,
            ),
          ),
          subtitle: Text(
            registration.isPrimary
                ? '${registration.councilName} · Principal'
                : registration.councilName,
            style: const TextStyle(fontSize: 12, color: AppColors.gray500),
          ),
          trailing: PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'edit') onEdit();
              if (value == 'deactivate') onDeactivate();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'edit', child: Text('Editar')),
              PopupMenuItem(value: 'deactivate', child: Text('Desativar')),
            ],
          ),
          onTap: onEdit,
        ),
      ),
    );
  }
}

class _RegistrationSheet extends ConsumerStatefulWidget {
  const _RegistrationSheet({
    required this.personId,
    required this.repository,
    required this.ref,
    this.existing,
  });

  final int personId;
  final PersonProfessionalRegistrationsRepository repository;
  final WidgetRef ref;
  final ProfessionalRegistration? existing;

  @override
  ConsumerState<_RegistrationSheet> createState() => _RegistrationSheetState();
}

class _RegistrationSheetState extends ConsumerState<_RegistrationSheet> {
  final _numberController = TextEditingController();
  List<ProfessionalRegistrationCouncil> _councils = const [];
  int? _councilId;
  String _stateCode = 'SP';
  bool _isPrimary = false;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    if (existing != null) {
      _councilId = existing.councilId;
      _stateCode = existing.stateCode;
      _numberController.text = existing.registrationNumber;
      _isPrimary = existing.isPrimary;
    }
    _loadCouncils();
  }

  Future<void> _loadCouncils() async {
    try {
      final councils = await widget.ref
          .read(_councilsRepositoryProvider)
          .listActive();
      if (!mounted) return;
      setState(() {
        _councils = councils;
        _councilId ??= councils.isNotEmpty ? councils.first.id : null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _numberController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final councilId = _councilId;
    final number = _numberController.text.trim();
    if (councilId == null) {
      setState(() => _error = 'Selecione um conselho');
      return;
    }
    if (number.isEmpty) {
      setState(() => _error = 'Informe o número do registro');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (_isEdit) {
        await widget.repository.updateRegistration(
          registrationId: widget.existing!.id,
          councilId: councilId,
          stateCode: _stateCode,
          registrationNumber: number,
          isPrimary: _isPrimary,
        );
      } else {
        await widget.repository.create(
          councilId: councilId,
          stateCode: _stateCode,
          registrationNumber: number,
          isPrimary: _isPrimary,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _isEdit ? 'Editar registro' : 'Novo registro profissional',
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            DropdownButtonFormField<int>(
              value: _councilId,
              decoration: const InputDecoration(
                labelText: 'Conselho',
                border: OutlineInputBorder(),
              ),
              items: _councils
                  .map(
                    (c) => DropdownMenuItem(
                      value: c.id,
                      child: Text('${c.abbreviation} — ${c.name}'),
                    ),
                  )
                  .toList(growable: false),
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _councilId = value),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _stateCode,
              decoration: const InputDecoration(
                labelText: 'UF',
                border: OutlineInputBorder(),
              ),
              items: kBrazilUfCodes
                  .map((uf) => DropdownMenuItem(value: uf, child: Text(uf)))
                  .toList(growable: false),
              onChanged: _saving
                  ? null
                  : (value) {
                      if (value != null) setState(() => _stateCode = value);
                    },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _numberController,
              enabled: !_saving,
              decoration: const InputDecoration(
                labelText: 'Número',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.text,
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Registro principal'),
              value: _isPrimary,
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _isPrimary = value),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Salvando…' : 'Salvar'),
            ),
          ],
        ],
      ),
    );
  }
}
