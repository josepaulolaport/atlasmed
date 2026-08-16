import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/conformity_requirement.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_delete_action.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';

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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          existing == null
              ? '${saved.name} cadastrado'
              : '${saved.name} atualizado',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final requirementsAsync = ref.watch(adminConformityRequirementsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const AtlasAppBar(page: 'Requisitos'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.navyDeep,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Novo requisito'),
        onPressed: _openForm,
      ),
      body: SafeArea(
        child: requirementsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Não foi possível carregar.'),
                TextButton(
                  onPressed: () =>
                      ref.invalidate(adminConformityRequirementsProvider),
                  child: const Text('Tentar de novo'),
                ),
              ],
            ),
          ),
          data: (requirements) => ListView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
            children: [
              const Text(
                'Documentos que o cadastro pede de cada clínica. Um requisito '
                'ativo passa a faltar imediatamente em todas as clínicas do '
                'escopo dele.',
                style: TextStyle(fontSize: 12.5, color: AppColors.gray400),
              ),
              const SizedBox(height: 16),
              if (requirements.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text(
                    'Nenhum requisito cadastrado — o cadastro não pede nenhum '
                    'documento hoje.',
                    style: TextStyle(fontSize: 12.5, color: AppColors.error),
                  ),
                )
              else
                for (final requirement in requirements) ...[
                  _RequirementCard(
                    requirement: requirement,
                    onTap: () => _openForm(existing: requirement),
                  ),
                  const SizedBox(height: 8),
                ],
            ],
          ),
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

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.surfaceSecondary),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      requirement.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: requirement.isActive
                            ? AppColors.gray900
                            : AppColors.gray400,
                      ),
                    ),
                  ),
                  if (!requirement.isActive)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSecondary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'Inativo',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.gray700,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                requirement.scopeLabel,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.gray400,
                ),
              ),
              if (flags.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(
                  'Pede ${flags.join(' e ')}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.navyDeep,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
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
  late bool _requiresValidityDate = widget.existing?.requiresValidityDate ?? false;
  late bool _requiresFrontAndBack = widget.existing?.requiresFrontAndBack ?? false;
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('${existing.name} excluído')));
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
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: AppColors.gray950,
        title: Text(
          _isEditing ? 'Editar requisito' : 'Novo requisito',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        actions: [
          if (_isEditing)
            // The shared button, not a bare icon: it disables itself when the
            // list already said this requirement is answered, so the admin is
            // never offered a delete the API will refuse (spec 0016 §6.2).
            CatalogDeleteButton(
              deletability: widget.existing?.deletability,
              onDelete: _delete,
              blockedTitle: 'Este requisito não pode ser excluído',
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                children: [
                  const _Label('Nome do documento'),
                  TextField(
                    controller: _name,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      hintText: 'Ex.: Licença Sanitária',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const _Label('Descrição'),
                  TextField(
                    controller: _description,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      hintText: 'Opcional — o que o representante deve enviar',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const _Label('Identificador (slug)'),
                  TextField(
                    controller: _slug,
                    enabled: !_isEditing,
                    decoration: InputDecoration(
                      hintText: 'Derivado do nome se ficar vazio',
                      border: const OutlineInputBorder(),
                      filled: _isEditing,
                      fillColor: AppColors.surfaceSecondary,
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
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                      ),
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
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                    ),
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
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: _requiresValidityDate,
                    onChanged: (value) =>
                        setState(() => _requiresValidityDate = value),
                    title: const Text(
                      'Pede data de validade',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: const Text(
                      'Uma Licença Sanitária vence; um Cartão CNPJ não. O aviso '
                      'de vencimento sai desta data.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray400,
                      ),
                    ),
                  ),
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: _requiresFrontAndBack,
                    onChanged: (value) =>
                        setState(() => _requiresFrontAndBack = value),
                    title: const Text(
                      'Pede frente e verso',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
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
                            TextField(
                              controller: _maxFiles,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                border: OutlineInputBorder(),
                              ),
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
                            TextField(
                              controller: _maxFileSizeMb,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                border: OutlineInputBorder(),
                              ),
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
                            TextField(
                              controller: _maxCombinedMb,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const _Section('ESTADO'),
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: _isActive,
                    onChanged: (value) => setState(() => _isActive = value),
                    title: const Text(
                      'Ativo',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: const Text(
                      'Um requisito inativo some das listas de cadastro. O que '
                      'já foi enviado continua valendo.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray400,
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.error,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: FilledButton(
                onPressed: _isValid && !_saving ? _submit : null,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.navyDeep,
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

class _Label extends StatelessWidget {
  const _Label(this.text);

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

class _Section extends StatelessWidget {
  const _Section(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 11,
      fontWeight: FontWeight.w700,
      color: AppColors.gray400,
      letterSpacing: 0.5,
    ),
  );
}
