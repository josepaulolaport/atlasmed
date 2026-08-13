import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:atlasmed_mobile_app/features/explore/data/domain/cnes_import_draft.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/cnes_suggestions.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/healthcare_specialty.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/person_facility_role_catalog.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_registration.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/healthcare_specialties_catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/person_facility_roles_catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/person_professional_registration_councils_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Builds the catalogue repositories the wizard reads, so a test can supply
/// them. Mirrors the seam the associate sheet already offers.
typedef CnesImportCatalogues = ({
  Future<List<HealthcareSpecialty>> Function() specialties,
  Future<List<PersonFacilityRoleCatalogEntry>> Function() roles,
  Future<List<ProfessionalRegistrationCouncil>> Function() councils,
});

CnesImportCatalogues _defaultCatalogues() => (
  specialties: () => HealthcareSpecialtiesCatalogRepository().listActive(),
  roles: () => PersonFacilityRolesCatalogRepository().listActive(),
  councils: () =>
      PersonProfessionalRegistrationCouncilsRepository().listActive(),
);

/// What one run of the wizard produced.
class CnesImportOutcome {
  const CnesImportOutcome({required this.imported, required this.reused});

  /// Doctors now on the roster, in the order they were confirmed.
  final List<ProfessionalRoster> imported;

  /// How many turned out to be people we already held, resolved by their
  /// council registration rather than created a second time.
  final int reused;
}

/// Fills in a doctor's profile before importing them from CNES (spec 0012 §6).
///
/// A route rather than a step inside the sheet. Importing creates a person, and
/// a person created from four prefilled fields is one somebody has to go and
/// finish later — by which time nobody remembers which of the roster's doctors
/// are half-written. The wizard makes the moment of creation the moment the
/// profile is complete.
///
/// Several doctors are queued rather than batched: each is written as its own
/// run completes, so quitting halfway keeps the ones already confirmed. A batch
/// would either lose them all or need a partial-failure story nobody would read.
class CnesImportWizard extends StatefulWidget {
  const CnesImportWizard({
    super.key,
    required this.facilityId,
    required this.suggestions,
    required this.repositoryBuilder,
    this.catalogues,
  });

  final int facilityId;

  /// The people CNES places here that we do not hold, in the order ticked.
  final List<CnesSuggestion> suggestions;

  final FacilityAssociateRepository Function(int facilityId) repositoryBuilder;

  final CnesImportCatalogues? catalogues;

  @override
  State<CnesImportWizard> createState() => _CnesImportWizardState();
}

class _CnesImportWizardState extends State<CnesImportWizard> {
  static const _stepTitles = ['Identidade e contato', 'Clínico', 'Revisão'];

  late final List<CnesImportDraft> _drafts = widget.suggestions
      .map(CnesImportDraft.fromSuggestion)
      .toList(growable: false);

  int _index = 0;
  int _step = 0;
  bool _loadingCatalogues = true;
  String? _catalogueError;
  bool _saving = false;

  List<HealthcareSpecialty> _specialties = const [];
  List<PersonFacilityRoleCatalogEntry> _roles = const [];
  List<ProfessionalRegistrationCouncil> _councils = const [];

  final List<ProfessionalRoster> _imported = [];
  int _reused = 0;

  CnesImportDraft get _draft => _drafts[_index];

  @override
  void initState() {
    super.initState();
    _loadCatalogues();
  }

  /// Specialty and role are required, so a catalogue that failed to load is a
  /// blocked wizard rather than a degraded one — say so instead of showing an
  /// empty picker that reads as "there are none".
  Future<void> _loadCatalogues() async {
    final catalogues = widget.catalogues ?? _defaultCatalogues();
    try {
      final specialties = await catalogues.specialties();
      final roles = await catalogues.roles();
      // Councils only matter if the rep adds a registration by hand, so a
      // failure here costs that one affordance and nothing else.
      List<ProfessionalRegistrationCouncil> councils = const [];
      try {
        councils = await catalogues.councils();
      } catch (_) {
        councils = const [];
      }
      if (!mounted) return;
      setState(() {
        _specialties = specialties;
        _roles = PersonFacilityRoleCatalog.activeEntries(roles);
        _councils = councils;
        _loadingCatalogues = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingCatalogues = false;
        _catalogueError = 'Não foi possível carregar especialidades e papéis.';
      });
    }
  }

  bool get _canAdvance {
    if (_saving) return false;
    switch (_step) {
      case 0:
        return _draft.isIdentityComplete;
      case 1:
        return _draft.isClinicalComplete;
      default:
        return _draft.isReadyToImport;
    }
  }

  void _back() {
    if (_step > 0) {
      setState(() => _step -= 1);
      return;
    }
    _quit();
  }

  /// Leaving keeps whatever was already imported: each doctor is written as
  /// their own run completes, so there is nothing half-saved to discard.
  void _quit() {
    Navigator.of(
      context,
    ).pop(CnesImportOutcome(imported: _imported, reused: _reused));
  }

  Future<void> _next() async {
    if (_step < 2) {
      setState(() => _step += 1);
      return;
    }
    await _import();
  }

  Future<void> _import() async {
    setState(() => _saving = true);
    final repo = widget.repositoryBuilder(widget.facilityId);
    try {
      final draft = _draft;
      final result = await repo.importCnesProfessional(draft.toImportBody());

      /*
       * A person the server resolved to rather than created still needs
       * linking: they existed before this clinic, and the import refuses to
       * write a second record for a registration somebody already holds. The
       * CNES association carries the occupations the rep just confirmed.
       */
      if (result.alreadyExisted) {
        _reused += 1;
        await repo.associateCnesProfessional(
          professionalCnesId: draft.suggestion.professionalCnesId,
          occupationIds: draft.occupationIds,
        );
      }

      _imported.add(
        draft.suggestion
            .toRoster(importedAs: result.personId)
            .copyWith(name: draft.displayName),
      );

      if (!mounted) return;
      if (_index + 1 >= _drafts.length) {
        _quit();
        return;
      }
      setState(() {
        _index += 1;
        _step = 0;
        _saving = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is FacilityAssociateException
                ? (e.message ?? 'Falha ao importar profissional')
                : 'Falha ao importar profissional',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      repo.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _quit();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          leading: IconButton(
            key: const Key('wizard-back'),
            icon: const Icon(Icons.arrow_back),
            onPressed: _saving ? null : _back,
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _draft.suggestion.displayName,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
              ),
              Text(
                _drafts.length > 1
                    ? '${_index + 1} de ${_drafts.length} · ${_stepTitles[_step]}'
                    : _stepTitles[_step],
                style: const TextStyle(fontSize: 12, color: AppColors.gray500),
              ),
            ],
          ),
        ),
        body: _buildBody(),
        bottomNavigationBar: _buildFooter(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loadingCatalogues) {
      return const Center(child: CircularProgressIndicator());
    }
    final error = _catalogueError;
    if (error != null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              error,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.gray700),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                setState(() {
                  _loadingCatalogues = true;
                  _catalogueError = null;
                });
                _loadCatalogues();
              },
              child: const Text('Tentar de novo'),
            ),
          ],
        ),
      );
    }

    // Keyed by doctor and step so moving between them rebuilds the fields from
    // the draft instead of carrying the previous doctor's controllers across.
    final key = ValueKey('${_draft.suggestion.professionalCnesId}-$_step');
    switch (_step) {
      case 0:
        return _IdentityStep(
          key: key,
          draft: _draft,
          councils: _councils,
          onChanged: () => setState(() {}),
        );
      case 1:
        return _ClinicalStep(
          key: key,
          draft: _draft,
          specialties: _specialties,
          roles: _roles,
          onChanged: () => setState(() {}),
        );
      default:
        return _ReviewStep(
          key: key,
          draft: _draft,
          specialties: _specialties,
          roles: _roles,
          onChanged: () => setState(() {}),
          onEditStep: (step) => setState(() => _step = step),
        );
    }
  }

  Widget _buildFooter() {
    final isLast = _step == 2;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _saving ? null : _back,
                child: Text(_step == 0 ? 'Cancelar' : 'Voltar'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: FilledButton(
                key: const Key('wizard-next'),
                onPressed: _canAdvance ? _next : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.navyBright,
                ),
                child: _saving
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(isLast ? 'Importar' : 'Continuar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Step 1 — who they are and how to reach them.
class _IdentityStep extends StatelessWidget {
  const _IdentityStep({
    super.key,
    required this.draft,
    required this.councils,
    required this.onChanged,
  });

  final CnesImportDraft draft;
  final List<ProfessionalRegistrationCouncil> councils;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        _field(
          key: const Key('wizard-first-name'),
          label: 'Nome',
          initial: draft.firstName,
          onChanged: (v) {
            draft.firstName = v;
            onChanged();
          },
        ),
        _field(
          key: const Key('wizard-last-name'),
          label: 'Sobrenome',
          initial: draft.lastName,
          onChanged: (v) {
            draft.lastName = v;
            onChanged();
          },
        ),
        _field(
          label: 'Nome social',
          initial: draft.socialName,
          onChanged: (v) => draft.socialName = v,
        ),
        _field(
          key: const Key('wizard-cpf'),
          label: 'CPF',
          initial: draft.cpf,
          keyboardType: TextInputType.number,
          formatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: 11,
          errorText: draft.cpfError,
          onChanged: (v) {
            draft.cpf = v;
            onChanged();
          },
        ),
        _field(
          label: 'Celular',
          initial: draft.mobilePhone,
          keyboardType: TextInputType.phone,
          onChanged: (v) => draft.mobilePhone = v,
        ),
        _field(
          label: 'Telefone fixo',
          initial: draft.landlinePhone,
          keyboardType: TextInputType.phone,
          onChanged: (v) => draft.landlinePhone = v,
        ),
        _field(
          label: 'E-mail',
          initial: draft.email,
          keyboardType: TextInputType.emailAddress,
          onChanged: (v) => draft.email = v,
        ),
        const SizedBox(height: 8),
        const _SectionLabel('Registro profissional'),
        _RegistrationsBlock(
          draft: draft,
          councils: councils,
          onChanged: onChanged,
        ),
      ],
    );
  }
}

/// The CNES registration, plus any the rep adds.
///
/// The sourced one is deliberately not a field. It is the identity the whole
/// feature resolves a doctor by, it has to match CNES, and it is the value a
/// hurried rep is most likely to mistype — so it is shown, and adding a second
/// council is a separate, additive action.
class _RegistrationsBlock extends StatelessWidget {
  const _RegistrationsBlock({
    required this.draft,
    required this.councils,
    required this.onChanged,
  });

  final CnesImportDraft draft;
  final List<ProfessionalRegistrationCouncil> councils;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final sourced = draft.sourcedRegistrationLabel;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (sourced != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              sourced,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
            subtitle: const Text(
              'Informado pelo CNES · não editável',
              style: TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
            trailing: const Icon(Icons.lock_outline, size: 18),
          ),
        for (final registration in draft.extraRegistrations)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              registration.label,
              style: const TextStyle(fontSize: 14, color: AppColors.gray900),
            ),
            trailing: IconButton(
              icon: const Icon(Icons.close, size: 18),
              onPressed: () {
                draft.extraRegistrations.remove(registration);
                onChanged();
              },
            ),
          ),
        if (councils.isNotEmpty)
          TextButton.icon(
            key: const Key('wizard-add-registration'),
            onPressed: () async {
              final added = await showDialog<DraftRegistration>(
                context: context,
                builder: (_) => _AddRegistrationDialog(councils: councils),
              );
              if (added != null) {
                draft.extraRegistrations.add(added);
                onChanged();
              }
            },
            icon: const Icon(Icons.add, size: 18),
            label: const Text('adicionar registro'),
          ),
      ],
    );
  }
}

class _AddRegistrationDialog extends StatefulWidget {
  const _AddRegistrationDialog({required this.councils});

  final List<ProfessionalRegistrationCouncil> councils;

  @override
  State<_AddRegistrationDialog> createState() => _AddRegistrationDialogState();
}

class _AddRegistrationDialogState extends State<_AddRegistrationDialog> {
  late int _councilId = widget.councils.first.id;
  String _stateCode = '';
  String _number = '';

  bool get _isValid =>
      RegExp(r'^[A-Za-z]{2}$').hasMatch(_stateCode) &&
      RegExp(r'^\d+$').hasMatch(_number);

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Adicionar registro'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<int>(
            initialValue: _councilId,
            decoration: const InputDecoration(labelText: 'Conselho'),
            items: [
              for (final council in widget.councils)
                DropdownMenuItem(
                  value: council.id,
                  child: Text(council.abbreviation),
                ),
            ],
            onChanged: (v) => setState(() => _councilId = v ?? _councilId),
          ),
          TextField(
            key: const Key('wizard-registration-uf'),
            decoration: const InputDecoration(labelText: 'UF'),
            maxLength: 2,
            textCapitalization: TextCapitalization.characters,
            onChanged: (v) => setState(() => _stateCode = v),
          ),
          TextField(
            key: const Key('wizard-registration-number'),
            decoration: const InputDecoration(labelText: 'Número'),
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) => setState(() => _number = v),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('wizard-registration-save'),
          onPressed: _isValid
              ? () {
                  final council = widget.councils.firstWhere(
                    (c) => c.id == _councilId,
                  );
                  Navigator.of(context).pop(
                    DraftRegistration(
                      councilId: council.id,
                      councilAbbreviation: council.abbreviation,
                      stateCode: _stateCode.toUpperCase(),
                      registrationNumber: _number,
                    ),
                  );
                }
              : null,
          child: const Text('Adicionar'),
        ),
      ],
    );
  }
}

/// Step 2 — what they practise and what they are to this clinic.
class _ClinicalStep extends StatelessWidget {
  const _ClinicalStep({
    super.key,
    required this.draft,
    required this.specialties,
    required this.roles,
    required this.onChanged,
  });

  final CnesImportDraft draft;
  final List<HealthcareSpecialty> specialties;
  final List<PersonFacilityRoleCatalogEntry> roles;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final selected = specialties
        .where((s) => s.id == draft.specialtyId)
        .firstOrNull;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        const _SectionLabel('Especialidade *'),
        ListTile(
          key: const Key('wizard-specialty'),
          contentPadding: EdgeInsets.zero,
          title: Text(
            selected?.name ?? 'Selecionar especialidade',
            style: TextStyle(
              fontSize: 14,
              color: selected == null ? AppColors.gray500 : AppColors.gray900,
            ),
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () async {
            final picked = await showModalBottomSheet<HealthcareSpecialty>(
              context: context,
              isScrollControlled: true,
              // 66 rows fill the screen, and without this the search field
              // renders under the status bar.
              useSafeArea: true,
              builder: (_) => _SpecialtyPicker(specialties: specialties),
            );
            if (picked != null) {
              draft.specialtyId = picked.id;
              onChanged();
            }
          },
        ),
        const SizedBox(height: 8),
        // CNES publishes no specialty at all — only the CBO — so this is the
        // one clinical fact the rep genuinely supplies rather than confirms.
        const Text(
          'O CNES não informa especialidade, apenas a ocupação na clínica.',
          style: TextStyle(fontSize: 12, color: AppColors.gray500),
        ),
        const SizedBox(height: 20),
        const _SectionLabel('Ocupação nesta clínica'),
        if (draft.suggestion.occupationOptions.isEmpty)
          const Text(
            'O CNES não registra ocupação para este profissional aqui.',
            style: TextStyle(fontSize: 12, color: AppColors.gray500),
          )
        else
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final option in draft.suggestion.occupationOptions)
                FilterChip(
                  label: Text(option.name),
                  selected: draft.occupationIds.contains(option.id),
                  onSelected: (_) {
                    if (!draft.occupationIds.remove(option.id)) {
                      draft.occupationIds.add(option.id);
                    }
                    onChanged();
                  },
                ),
            ],
          ),
        const SizedBox(height: 20),
        const _SectionLabel('Papel na clínica *'),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final role in roles)
              FilterChip(
                label: Text(role.name),
                selected: draft.roleIds.contains(role.id),
                onSelected: (_) {
                  if (!draft.roleIds.remove(role.id)) {
                    draft.roleIds.add(role.id);
                  }
                  onChanged();
                },
              ),
          ],
        ),
      ],
    );
  }
}

class _SpecialtyPicker extends StatefulWidget {
  const _SpecialtyPicker({required this.specialties});

  final List<HealthcareSpecialty> specialties;

  @override
  State<_SpecialtyPicker> createState() => _SpecialtyPickerState();
}

class _SpecialtyPickerState extends State<_SpecialtyPicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final query = _query.trim().toLowerCase();
    final matches = query.isEmpty
        ? widget.specialties
        : widget.specialties
              .where((s) => s.name.toLowerCase().contains(query))
              .toList(growable: false);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                key: const Key('wizard-specialty-search'),
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Buscar especialidade',
                  prefixIcon: Icon(Icons.search),
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: matches.length,
                itemBuilder: (_, i) => ListTile(
                  title: Text(matches[i].name),
                  onTap: () => Navigator.of(context).pop(matches[i]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Step 3 — everything at once, plus the optional rapport notes.
///
/// Personal fields live here rather than in a fourth step: six of the 1 206
/// doctors we hold carry any of them, so a step of their own would be a screen
/// almost every import taps past. Collapsed, they are there for the rep who
/// just had the conversation and invisible to the one who did not.
class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    super.key,
    required this.draft,
    required this.specialties,
    required this.roles,
    required this.onChanged,
    required this.onEditStep,
  });

  final CnesImportDraft draft;
  final List<HealthcareSpecialty> specialties;
  final List<PersonFacilityRoleCatalogEntry> roles;
  final VoidCallback onChanged;
  final void Function(int step) onEditStep;

  @override
  Widget build(BuildContext context) {
    final specialty = specialties
        .where((s) => s.id == draft.specialtyId)
        .firstOrNull;
    final roleNames = roles
        .where((r) => draft.roleIds.contains(r.id))
        .map((r) => r.name)
        .toList(growable: false);
    final occupationNames = draft.suggestion.occupationOptions
        .where((o) => draft.occupationIds.contains(o.id))
        .map((o) => o.name)
        .toList(growable: false);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        _reviewSection('Identidade e contato', 0, [
          ('Nome', draft.displayName),
          ('Nome social', draft.socialName),
          ('CPF', draft.cpf),
          // No birth date row: it is edited below, in the optional section, and
          // "editar" here jumps to step 1 where the field no longer lives.
          ('Celular', draft.mobilePhone),
          ('Fixo', draft.landlinePhone),
          ('E-mail', draft.email),
          ('Registro', draft.sourcedRegistrationLabel),
          if (draft.extraRegistrations.isNotEmpty)
            (
              'Outros registros',
              draft.extraRegistrations.map((r) => r.label).join(', '),
            ),
        ]),
        const SizedBox(height: 8),
        _reviewSection('Clínico', 1, [
          ('Especialidade', specialty?.name),
          (
            'Ocupação',
            occupationNames.isEmpty ? null : occupationNames.join(', '),
          ),
          ('Papel', roleNames.isEmpty ? null : roleNames.join(', ')),
        ]),
        const SizedBox(height: 8),
        Card(
          elevation: 0,
          color: Colors.white,
          child: ExpansionTile(
            key: const Key('wizard-personal'),
            title: const Text(
              'Informações pessoais',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
            subtitle: const Text(
              'Opcional',
              style: TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            children: [
              /*
               * Birth date lives here rather than on step 1.
               *
               * Not one of the 1 206 doctors we hold has one, and every rep
               * skipped it — a field nobody fills sitting above CPF and phone
               * teaches people to scroll past that whole step.
               */
              _field(
                key: const Key('wizard-birth-date'),
                label: 'Data de nascimento (AAAA-MM-DD)',
                initial: draft.birthDate,
                errorText: draft.birthDateError,
                onChanged: (v) {
                  draft.birthDate = v;
                  onChanged();
                },
              ),
              _field(
                label: 'Hobbies',
                initial: draft.hobbies,
                onChanged: (v) => draft.hobbies = v,
              ),
              _field(
                label: 'Time',
                initial: draft.favoriteTeam,
                onChanged: (v) => draft.favoriteTeam = v,
              ),
              _field(
                label: 'Esporte',
                initial: draft.favoriteSport,
                onChanged: (v) => draft.favoriteSport = v,
              ),
              _field(
                label: 'Idiomas',
                initial: draft.languages,
                onChanged: (v) => draft.languages = v,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _reviewSection(String title, int step, List<(String, String?)> rows) {
    return Card(
      elevation: 0,
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                  ),
                ),
                TextButton(
                  onPressed: () => onEditStep(step),
                  child: const Text('editar'),
                ),
              ],
            ),
            for (final row in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 120,
                      child: Text(
                        row.$1,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: AppColors.gray500,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        // An unfilled field says so rather than showing a gap:
                        // the review exists to tell the rep what they are about
                        // to write, and a blank line reads as a rendering bug.
                        row.$2?.trim().isNotEmpty == true ? row.$2! : '—',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.gray900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w700,
        color: AppColors.gray700,
      ),
    ),
  );
}

Widget _field({
  Key? key,
  required String label,
  required String? initial,
  required ValueChanged<String> onChanged,
  TextInputType? keyboardType,
  List<TextInputFormatter>? formatters,
  int? maxLength,
  String? errorText,
}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: TextFormField(
      key: key,
      initialValue: initial,
      decoration: InputDecoration(
        labelText: label,
        counterText: '',
        errorText: errorText,
      ),
      keyboardType: keyboardType,
      inputFormatters: formatters,
      maxLength: maxLength,
      onChanged: onChanged,
    ),
  );
}
