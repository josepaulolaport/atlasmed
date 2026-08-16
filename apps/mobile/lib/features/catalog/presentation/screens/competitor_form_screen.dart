import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/product_deletability.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_delete_action.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_feedback.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_form_fields.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Admin-only full-screen form for registering a new competitor product
/// or editing an existing one. Same shape as [VariantFormScreen] — a
/// competitor product has no SIMPRO/BRASÍNDICE/TISS codes of its own (it's
/// only ever priced, never coded), so this form is deliberately shorter.
class CompetitorFormScreen extends ConsumerStatefulWidget {
  final CompetitorProduct? existing;

  const CompetitorFormScreen({super.key, this.existing});

  /// Pushes the form and returns the created/updated competitor product,
  /// or `null` if the admin cancelled.
  static Future<CompetitorProduct?> show(
    BuildContext context, {
    CompetitorProduct? existing,
  }) {
    return Navigator.of(context).push<CompetitorProduct?>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => CompetitorFormScreen(existing: existing),
      ),
    );
  }

  @override
  ConsumerState<CompetitorFormScreen> createState() =>
      _CompetitorFormScreenState();
}

class _CompetitorFormScreenState extends ConsumerState<CompetitorFormScreen> {
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _brand = TextEditingController(text: widget.existing?.brand);
  late final _manufacturer = TextEditingController(
    text: widget.existing?.manufacturer,
  );
  late final _countryOfOrigin = TextEditingController(
    text: widget.existing?.countryOfOrigin,
  );
  late final _price17 = TextEditingController(
    text: widget.existing != null ? brlNumber(widget.existing!.price17) : null,
  );
  late final _price18 = TextEditingController(
    text: widget.existing != null ? brlNumber(widget.existing!.price18) : null,
  );
  late final _price20 = TextEditingController(
    text: widget.existing != null ? brlNumber(widget.existing!.price20) : null,
  );

  late bool _isActive = widget.existing?.isActive ?? true;

  bool _saving = false;
  String? _error;

  bool get _isEditing => widget.existing != null;

  List<TextEditingController> get _controllers => [
    _name,
    _brand,
    _manufacturer,
    _countryOfOrigin,
    _price17,
    _price18,
    _price20,
  ];

  /// What the form looked like when it opened. See [CatalogUnsavedGuard].
  late final String _openedWith = _snapshot();

  String _snapshot() => [
    for (final controller in _controllers) controller.text,
    '$_isActive',
  ].join('\u0000');

  bool get _hasChanges => _snapshot() != _openedWith;

  /// Null until the answer arrives; see [CatalogDeleteButton].
  ProductDeletability? _deletability;

  @override
  void initState() {
    super.initState();
    for (final controller in _controllers) {
      controller.addListener(_onFieldChanged);
    }
    if (_isEditing) _loadDeletability();
  }

  Future<void> _loadDeletability() async {
    try {
      final answer = await ref
          .read(catalogRepositoryProvider)
          .getCompetitorDeletability(widget.existing!.id);
      if (!mounted) return;
      setState(() => _deletability = answer);
    } catch (_) {
      if (!mounted) return;
      setState(() => _deletability = ProductDeletability.unknown);
    }
  }

  Future<void> _delete() async {
    final existing = widget.existing!;
    final confirmed = await confirmCatalogDelete(
      context,
      name: existing.name,
      kind: 'produto',
    );
    if (!confirmed || !mounted) return;
    try {
      await ref
          .read(catalogRepositoryProvider)
          .deleteCompetitorProduct(existing.id);
      invalidateCatalog(ref);
      if (!mounted) return;
      Navigator.of(context).pop();
      showCatalogSnack(context, '${existing.name} excluído');
    } catch (error) {
      if (!mounted) return;
      showDeleteFailure(
        context,
        blockedTitle: 'Este produto não pode ser excluído',
        error: error,
      );
    }
  }

  void _onFieldChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller
        ..removeListener(_onFieldChanged)
        ..dispose();
    }
    super.dispose();
  }

  bool get _isValid =>
      _name.text.trim().isNotEmpty &&
      _manufacturer.text.trim().isNotEmpty &&
      _countryOfOrigin.text.trim().isNotEmpty &&
      parseBrlNumber(_price17.text) != null &&
      parseBrlNumber(_price18.text) != null &&
      parseBrlNumber(_price20.text) != null;

  String? get _missing {
    if (_name.text.trim().isEmpty) return 'Informe o nome do produto.';
    if (_manufacturer.text.trim().isEmpty) return 'Informe o fabricante.';
    if (_countryOfOrigin.text.trim().isEmpty) return 'Informe o país.';
    return 'Revise os preços: algum campo não é um número.';
  }

  Future<void> _submit() async {
    if (!_isValid || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final draft = (widget.existing ?? _blankCompetitor()).copyWith(
      name: _name.text.trim(),
      brand: _brand.text.trim().isEmpty ? null : _brand.text.trim(),
      manufacturer: _manufacturer.text.trim(),
      countryOfOrigin: _countryOfOrigin.text.trim(),
      price17: parseBrlNumber(_price17.text),
      price18: parseBrlNumber(_price18.text),
      price20: parseBrlNumber(_price20.text),
      isActive: _isActive,
      // Not stamped, and not derived from whether a price moved either: this
      // column records when the *Brasíndice* record was published, and no
      // competitor product has one (spec 0013 §2). Whatever the row already
      // carries is preserved.
    );

    try {
      final repository = ref.read(catalogRepositoryProvider);
      final saved = _isEditing
          ? await repository.updateCompetitorProduct(draft)
          : await repository.createCompetitorProduct(draft);
      invalidateCatalog(ref);
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

  CompetitorProduct _blankCompetitor() => CompetitorProduct(
    id: 0,
    name: '',
    manufacturer: '',
    countryOfOrigin: '',
    price17: 0,
    price18: 0,
    price20: 0,
    brasindiceUpdatedAt: null,
  );

  @override
  Widget build(BuildContext context) {
    return CatalogUnsavedGuard(
      hasChanges: _hasChanges,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: CatalogFormAppBar(
          title: _isEditing ? 'Editar produto' : 'Novo produto',
          action: _isEditing
              ? CatalogDeleteButton(
                  deletability: _deletability,
                  onDelete: _delete,
                  blockedTitle: 'Este produto não pode ser excluído',
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
                    const CatalogFieldLabel('Nome do produto'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _name,
                      hint: 'Ex.: SINGJOINT 24MG / 2ML',
                      capitalization: TextCapitalization.words,
                    ),
                    const SizedBox(height: 16),
                    const CatalogFieldLabel('Marca (opcional)'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _brand,
                      hint: 'Ex.: Synvisc',
                      capitalization: TextCapitalization.words,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('Fabricante'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _manufacturer,
                                hint: 'Hangzhou',
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('País'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _countryOfOrigin,
                                hint: 'China',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    const CatalogSectionLabel('PREÇOS'),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('ICMS 17%'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _price17,
                                hint: '0,00',
                                keyboardType: TextInputType.numberWithOptions(
                                  decimal: true,
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
                              const CatalogFieldLabel('ICMS 18%'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _price18,
                                hint: '0,00',
                                keyboardType: TextInputType.numberWithOptions(
                                  decimal: true,
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
                              const CatalogFieldLabel('ICMS 20%'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _price20,
                                hint: '0,00',
                                keyboardType: TextInputType.numberWithOptions(
                                  decimal: true,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    const CatalogSectionLabel('ESTADO'),
                    CatalogActiveSwitch(
                      value: _isActive,
                      onChanged: (value) => setState(() => _isActive = value),
                      explanation:
                          'Um produto inativo deixa de aparecer no comparativo e '
                          'no seletor do representante. As quantidades já '
                          'registradas nas clínicas continuam valendo.',
                    ),
                  ],
                ),
              ),
              CatalogSaveBar(
                onSave: _isValid ? _submit : null,
                saving: _saving,
                error: _error,
                disabledReason: _missing,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
