import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/conformity_requirement.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_delete_action.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_empty_state.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_feedback.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_form_fields.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_list_row.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/widgets/list_skeletons.dart';

/// `Administração › Requisitos de cadastro` (spec 0016 §4.7).
///
/// The catalogue of documents the cadastro asks each clinic for. Spec 0011 owns
/// the pipeline; this is the only way to fill the list it reads — and the table
/// was **empty in production**, which is why no clinic had anything to submit.
///
/// The widest-reaching write in the panel: an active requirement is immediately
/// missing from every clinic in scope. The form says so before it saves.
class AdminConformityRequirementsScreen extends ConsumerStatefulWidget {
  const AdminConformityRequirementsScreen({super.key});

  @override
  ConsumerState<AdminConformityRequirementsScreen> createState() =>
      _AdminConformityRequirementsScreenState();
}

class _AdminConformityRequirementsScreenState
    extends ConsumerState<AdminConformityRequirementsScreen> {
  Future<void> _openForm({ConformityRequirement? existing}) async {
    final saved = await Navigator.of(context).push<ConformityRequirement>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _RequirementFormScreen(existing: existing),
      ),
    );
    if (saved == null || !mounted) return;
    ref.invalidate(adminConformityRequirementsProvider);
    showCatalogSnack(
      context,
      existing == null
          ? '${saved.name} cadastrado'
          : '${saved.name} atualizado',
    );
  }

  @override
  Widget build(BuildContext context) {
    final requirementsAsync = ref.watch(adminConformityRequirementsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Requisitos de cadastro'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.navyDeep,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Novo requisito'),
        onPressed: _openForm,
      ),
      body: SafeArea(
        child: requirementsAsync.when(
          loading: () => const SimpleListSkeleton(),
          error: (_, _) => CatalogErrorState(
            onRetry: () => ref.invalidate(adminConformityRequirementsProvider),
          ),
          data: (requirements) {
            if (requirements.isEmpty) {
              // Not a neutral empty list: with no requirements the cadastro
              // asks every clinic for nothing, which is a configuration
              // problem rather than a blank slate.
              return const CatalogEmptyState(
                icon: Icons.assignment_late_outlined,
                title: 'O cadastro não pede nenhum documento',
                subtitle:
                    'Nenhum requisito está cadastrado, então nenhuma clínica '
                    'tem pendências. Toque em “Novo requisito” para começar.',
              );
            }
            return RefreshIndicator(
              color: AppColors.navyDeep,
              onRefresh: () async =>
                  ref.invalidate(adminConformityRequirementsProvider),
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                itemCount: requirements.length + 1,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  if (index == 0) {
                    return const Padding(
                      padding: EdgeInsets.only(bottom: 4),
                      child: Text(
                        'Documentos que o cadastro pede de cada clínica. Um '
                        'requisito ativo passa a faltar imediatamente em '
                        'todas as clínicas do escopo dele.',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: AppColors.gray500,
                          height: 1.45,
                        ),
                      ),
                    );
                  }
                  final requirement = requirements[index - 1];
                  return _RequirementCard(
                    requirement: requirement,
                    onTap: () => _openForm(existing: requirement),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _RequirementCard extends StatelessWidget {
  const _RequirementCard({required this.requirement, required this.onTap});

  final ConformityRequirement requirement;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final flags = <String>[
      if (requirement.requiresValidityDate) 'validade',
      if (requirement.requiresFrontAndBack) 'frente e verso',
    ];

    return CatalogListRow(
      leading: const CatalogRowIcon(icon: Icons.description_outlined),
      title: requirement.name,
      subtitle: requirement.scopeLabel,
      note: flags.isEmpty ? null : 'Pede ${flags.join(' e ')}',
      isActive: requirement.isActive,
      onTap: onTap,
    );
  }
}

class _RequirementFormScreen extends ConsumerStatefulWidget {
  const _RequirementFormScreen({this.existing});

  final ConformityRequirement? existing;

  @override
  ConsumerState<_RequirementFormScreen> createState() =>
      _RequirementFormScreenState();
}

class _RequirementFormScreenState
    extends ConsumerState<_RequirementFormScreen> {
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _description = TextEditingController(
    text: widget.existing?.description,
  );
  late final _slug = TextEditingController(text: widget.existing?.slug);
  late final _maxFiles = TextEditingController(
    text: (widget.existing?.maxFiles ?? 10).toString(),
  );
  late final _maxFileSizeMb = TextEditingController(
    text: _toMb(widget.existing?.maxFileSizeBytes ?? 52428800),
  );
  late final _maxCombinedMb = TextEditingController(
    text: _toMb(widget.existing?.maxCombinedSizeBytes ?? 209715200),
  );

  late int? _verticalId = widget.existing?.verticalId;
  late RequirementLegalDocumentType? _documentType =
      widget.existing?.appliesToLegalDocumentType;
  late bool _isActive = widget.existing?.isActive ?? true;
  late bool _requiresValidityDate =
      widget.existing?.requiresValidityDate ?? false;
  late bool _requiresFrontAndBack =
      widget.existing?.requiresFrontAndBack ?? false;
  late final Set<String> _mimeTypes = {
    ...?widget.existing?.allowedMimeTypes,
    if (widget.existing == null) ...const [
      'image/jpeg',
      'image/png',
      'application/pdf',
    ],
  };

  bool _saving = false;
  String? _error;

  bool get _isEditing => widget.existing != null;

  static String _toMb(int bytes) => (bytes / 1024 / 1024).round().toString();

  static const _mimeOptions = <String, String>{
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'application/pdf': 'PDF',
    'image/heic': 'HEIC',
  };

  List<TextEditingController> get _controllers => [
    _name,
    _description,
    _slug,
    _maxFiles,
    _maxFileSizeMb,
    _maxCombinedMb,
  ];

  @override
  void initState() {
    super.initState();
    for (final controller in _controllers) {
      controller.addListener(_onChanged);
    }
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller
        ..removeListener(_onChanged)
        ..dispose();
    }
    super.dispose();
  }

  bool get _isValid =>
      _name.text.trim().isNotEmpty &&
      _mimeTypes.isNotEmpty &&
      (int.tryParse(_maxFiles.text.trim()) ?? 0) > 0 &&
      (int.tryParse(_maxFileSizeMb.text.trim()) ?? 0) > 0 &&
      (int.tryParse(_maxCombinedMb.text.trim()) ?? 0) > 0;

  ConformityRequirement _draft() => ConformityRequirement(
    id: widget.existing?.id ?? 0,
    slug: widget.existing?.slug ?? '',
    name: _name.text.trim(),
    isActive: _isActive,
    description: _description.text.trim().isEmpty
        ? null
        : _description.text.trim(),
    verticalId: _verticalId,
    appliesToLegalDocumentType: _documentType,
    allowedMimeTypes: _mimeTypes.toList(),
    maxFiles: int.parse(_maxFiles.text.trim()),
    maxFileSizeBytes: int.parse(_maxFileSizeMb.text.trim()) * 1024 * 1024,
    maxCombinedSizeBytes: int.parse(_maxCombinedMb.text.trim()) * 1024 * 1024,
    requiresFrontAndBack: _requiresFrontAndBack,
    requiresValidityDate: _requiresValidityDate,
  );

  /// A new *active* requirement changes the conformity of the whole base at
  /// once, so it is confirmed rather than merely saved.
  Future<bool> _confirmActivation() async {
    if (!_isActive) return true;
    if (_isEditing && (widget.existing?.isActive ?? false)) return true;

    final scope = _draft().scopeLabel;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ativar este requisito?'),
        content: Text(
          'Ele passa a ser exigido imediatamente de todas as clínicas do '
          'escopo ($scope) — e conta como pendente em cada uma até ser '
          'enviado.\n\nPara preparar sem exigir agora, salve como inativo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ativar'),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  Future<void> _submit() async {
    if (!_isValid || _saving) return;
    if (!await _confirmActivation()) return;
    if (!mounted) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repository = ref.read(catalogRepositoryProvider);
      final saved = _isEditing
          ? await repository.updateConformityRequirement(_draft())
          : await repository.createConformityRequirement(
              _draft(),
              slug: _slug.text,
            );
      if (!mounted) return;
      Navigator.of(context).pop(saved);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is CatalogApiException
            ? error.message
            : 'Não foi possível salvar. Tente novamente.';
      });
    }
  }

  Future<void> _delete() async {
    final existing = widget.existing!;
    final confirmed = await confirmCatalogDelete(
      context,
      name: existing.name,
      kind: 'requisito',
      // This entity's own vocabulary — "nenhum pedido ou equivalência" would be
      // the catalogue's, and meaningless for a document.
      referencesLabel:
          'nenhuma clínica respondeu e nenhum documento foi enviado',
    );
    if (!confirmed || !mounted) return;
    try {
      await ref
          .read(catalogRepositoryProvider)
          .deleteConformityRequirement(existing.id);
      ref.invalidate(adminConformityRequirementsProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      showCatalogSnack(context, '${existing.name} excluído');
    } catch (error) {
      if (!mounted) return;
      showDeleteFailure(
        context,
        blockedTitle: 'Este requisito não pode ser excluído',
        error: error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final verticalsAsync = ref.watch(catalogVerticalsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CatalogFormAppBar(
        title: _isEditing ? 'Editar requisito' : 'Novo requisito',
        // The shared button, not a bare icon: it disables itself when the list
        // already said this requirement is answered, so the admin is never
        // offered a delete the API will refuse (spec 0016 §6.2).
        action: _isEditing
            ? CatalogDeleteButton(
                deletability: widget.existing?.deletability,
                onDelete: _delete,
                blockedTitle: 'Este requisito não pode ser excluído',
              )
            : null,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                children: [
                  const _Label('Nome do documento'),
                  CatalogTextInput(
                    controller: _name,
                    capitalization: TextCapitalization.sentences,
                    hint: 'Ex.: Licença Sanitária',
                  ),
                  const SizedBox(height: 14),
                  const _Label('Descrição'),
                  CatalogTextInput(
                    controller: _description,
                    capitalization: TextCapitalization.sentences,
                    hint: 'Opcional — o que o representante deve enviar',
                  ),
                  const SizedBox(height: 14),
                  const _Label('Identificador (slug)'),
                  // Locked once saved: the slug is the key this document
                  // travels by, so the field is disabled rather than removed —
                  // an admin looking for it deserves to see it and the reason.
                  _ReadOnlyWhenEditing(
                    isEditing: _isEditing,
                    child: CatalogTextInput(
                      controller: _slug,
                      hint: 'Derivado do nome se ficar vazio',
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _isEditing
                        ? 'Definido no cadastro e não editável: é a chave com '
                              'que este documento viaja em todo o cadastro.'
                        : 'Chave estável deste documento. Escolhida uma vez.',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.gray400,
                    ),
                  ),
                  const SizedBox(height: 20),
                  const _Section('ESCOPO'),
                  const SizedBox(height: 4),
                  const Text(
                    'De quem este documento é exigido. Quanto mais amplo, mais '
                    'clínicas passam a ter uma pendência.',
                    style: TextStyle(fontSize: 11.5, color: AppColors.gray400),
                  ),
                  const SizedBox(height: 10),
                  const _Label('Linha comercial'),
                  verticalsAsync.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (_, _) => const Text(
                      'Não foi possível carregar as linhas.',
                      style: TextStyle(fontSize: 12.5, color: AppColors.error),
                    ),
                    data: (verticals) => DropdownButtonFormField<int?>(
                      initialValue: _verticalId,
                      isDense: true,
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.gray900,
                      ),
                      decoration: catalogInputDecoration,
                      items: [
                        const DropdownMenuItem(
                          value: null,
                          child: Text('Todas as linhas'),
                        ),
                        for (final vertical in verticals)
                          DropdownMenuItem(
                            value: vertical.id,
                            child: Text(vertical.name),
                          ),
                      ],
                      onChanged: (value) => setState(() => _verticalId = value),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const _Label('Tipo de documento da clínica'),
                  DropdownButtonFormField<RequirementLegalDocumentType?>(
                    initialValue: _documentType,
                    isDense: true,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.gray900,
                    ),
                    decoration: catalogInputDecoration,
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('CNPJ e CPF'),
                      ),
                      for (final type in RequirementLegalDocumentType.values)
                        DropdownMenuItem(value: type, child: Text(type.label)),
                    ],
                    onChanged: (value) => setState(() => _documentType = value),
                  ),
                  const SizedBox(height: 20),
                  const _Section('O QUE SERÁ PEDIDO'),
                  CatalogActiveSwitch(
                    value: _requiresValidityDate,
                    label: 'Pede data de validade',
                    onChanged: (value) =>
                        setState(() => _requiresValidityDate = value),
                    explanation:
                        'Uma Licença Sanitária vence; um Cartão CNPJ não. O '
                        'aviso de vencimento sai desta data.',
                  ),
                  CatalogActiveSwitch(
                    value: _requiresFrontAndBack,
                    label: 'Pede frente e verso',
                    onChanged: (value) =>
                        setState(() => _requiresFrontAndBack = value),
                    explanation:
                        'Duas imagens em vez de uma — documentos de identidade '
                        'costumam precisar.',
                  ),
                  const SizedBox(height: 14),
                  const _Label('Tipos de arquivo aceitos'),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final entry in _mimeOptions.entries)
                        FilterChip(
                          label: Text(entry.value),
                          selected: _mimeTypes.contains(entry.key),
                          onSelected: (selected) => setState(() {
                            if (selected) {
                              _mimeTypes.add(entry.key);
                            } else {
                              _mimeTypes.remove(entry.key);
                            }
                          }),
                        ),
                    ],
                  ),
                  if (_mimeTypes.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 6),
                      child: Text(
                        'Escolha ao menos um tipo — senão não há nada que o '
                        'representante possa enviar.',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: AppColors.error,
                        ),
                      ),
                    ),
                  const SizedBox(height: 20),
                  const _Section('LIMITES DE ENVIO'),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _Label('Máx. arquivos'),
                            CatalogTextInput(
                              controller: _maxFiles,
                              keyboardType: TextInputType.number,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _Label('Máx. por arquivo (MB)'),
                            CatalogTextInput(
                              controller: _maxFileSizeMb,
                              keyboardType: TextInputType.number,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _Label('Máx. total (MB)'),
                            CatalogTextInput(
                              controller: _maxCombinedMb,
                              keyboardType: TextInputType.number,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const _Section('ESTADO'),
                  CatalogActiveSwitch(
                    value: _isActive,
                    onChanged: (value) => setState(() => _isActive = value),
                    explanation:
                        'Um requisito inativo some das listas de cadastro. O '
                        'que já foi enviado continua valendo.',
                  ),
                ],
              ),
            ),
            CatalogSaveBar(
              onSave: _isValid ? _submit : null,
              saving: _saving,
              error: _error,
            ),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: CatalogFieldLabel(text),
  );
}

class _Section extends StatelessWidget {
  const _Section(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => CatalogSectionLabel(text);
}

/// Greys out and blocks a field once the requirement exists.
///
/// `TextField(enabled: false)` alone drops to Material's disabled colours,
/// which do not match anything else in the panel; this keeps the panel's field
/// and shows its locked state the way the rest of the form shows state.
class _ReadOnlyWhenEditing extends StatelessWidget {
  const _ReadOnlyWhenEditing({required this.isEditing, required this.child});

  final bool isEditing;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!isEditing) return child;
    return Opacity(opacity: 0.6, child: IgnorePointer(child: child));
  }
}
