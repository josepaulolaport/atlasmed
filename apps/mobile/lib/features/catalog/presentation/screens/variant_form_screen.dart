import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/product_deletability.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_delete_action.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_feedback.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_form_fields.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/screens/manage_competitors_screen.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_widgets.dart'
    show formatDate;
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/product_thumbnail.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Admin-only full-screen form for creating a new AtlasMed product variant
/// or editing an existing one — mirrors [TerritoryInfoForm]'s shape
/// (fullscreen dialog, labeled fields, bottom "Salvar" bar) so every
/// admin-mutation form in the app reads the same way.
///
/// Spec 0016 §4.2 widened it to every editable column. Three rules are visible
/// in the UI rather than only in the API:
///
/// - **Codes are optional.** SIMPRO / Brasíndice / TISS / código are nullable by
///   correctness (spec 0013 §2); an empty field saves as `null`, not `""`.
/// - **`metricUnits` is read-only** (§7.1) — displayed with its unit, never
///   editable, because the metric calculation uses raw quantities.
/// - **The picture is uploaded, not typed** (§4.2). `pictureUrl` is not a body
///   field: it names an object this API stores, so it is written by
///   `POST`/`DELETE /products/:id/picture` and saved the moment it is chosen,
///   before "Salvar". A new product has no id to hang an object off yet, so the
///   section says so instead of pretending to accept one.
/// - **Linhas are chosen once** (§6.7). On an existing product they render as
///   plain text with the reason, because moving a product between Linhas
///   changes which profiles its orders join to.
class VariantFormScreen extends ConsumerStatefulWidget {
  final CatalogVariant? existing;
  final List<CatalogFamily> families;

  const VariantFormScreen({super.key, this.existing, required this.families});

  /// Pushes the form and returns the created/updated variant, or `null` if
  /// the admin cancelled.
  static Future<CatalogVariant?> show(
    BuildContext context, {
    CatalogVariant? existing,
    required List<CatalogFamily> families,
  }) {
    return Navigator.of(context).push<CatalogVariant?>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) =>
            VariantFormScreen(existing: existing, families: families),
      ),
    );
  }

  @override
  ConsumerState<VariantFormScreen> createState() => _VariantFormScreenState();
}

class _VariantFormScreenState extends ConsumerState<VariantFormScreen> {
  late final _name = TextEditingController(text: widget.existing?.name);
  late final _code = TextEditingController(text: widget.existing?.code);
  late final _familyName = TextEditingController(
    text: widget.existing?.familyName,
  );
  late final _presentation = TextEditingController(
    text: widget.existing?.presentation,
  );
  late final _manufacturer = TextEditingController(
    text: widget.existing?.manufacturer,
  );
  late final _countryOfOrigin = TextEditingController(
    text: widget.existing?.countryOfOrigin,
  );
  late final _simproCode = TextEditingController(
    text: widget.existing?.simproCode,
  );
  late final _brasindiceCode = TextEditingController(
    text: widget.existing?.brasindiceCode,
  );
  late final _tissCode = TextEditingController(text: widget.existing?.tissCode);
  late final _description = TextEditingController(
    text: widget.existing?.description,
  );
  late final _brand = TextEditingController(text: widget.existing?.brand);
  late final _unit = TextEditingController(text: widget.existing?.unit);
  late final _barcode = TextEditingController(text: widget.existing?.barcode);
  late final _ncm = TextEditingController(text: widget.existing?.ncm);
  late final _anvisaRegistration = TextEditingController(
    text: widget.existing?.anvisaRegistration,
  );
  late final _commercialCode = TextEditingController(
    text: widget.existing?.commercialCode,
  );
  late final _productClassification = TextEditingController(
    text: widget.existing?.productClassification,
  );
  late final _internalClassification = TextEditingController(
    text: widget.existing?.internalClassification,
  );
  late final _idProdutoEmultec = TextEditingController(
    text: widget.existing?.idProdutoEmultec?.toString(),
  );
  late final _price = TextEditingController(
    text: widget.existing != null ? brlNumber(widget.existing!.price) : null,
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

  late final Set<int> _selectedVerticalIds = {
    ...widget.existing?.verticalIds ?? [],
  };
  late bool _requiresSterilization =
      widget.existing?.requiresSterilization ?? false;
  late bool _isActive = widget.existing?.isActive ?? true;
  late DateTime? _brasindiceUpdatedAt = widget.existing?.brasindiceUpdatedAt;

  bool _saving = false;
  String? _error;

  /// The picture is written by its own endpoint the moment it is chosen, so it
  /// lives outside the draft the "Salvar" button sends.
  late String? _pictureUrl = widget.existing?.pictureUrl;
  late String? _pictureBlurhash = widget.existing?.pictureBlurhash;
  bool _pictureBusy = false;

  bool get _isEditing => widget.existing != null;

  List<TextEditingController> get _controllers => [
    _name,
    _code,
    _familyName,
    _presentation,
    _manufacturer,
    _countryOfOrigin,
    _simproCode,
    _brasindiceCode,
    _tissCode,
    _description,
    _brand,
    _unit,
    _barcode,
    _ncm,
    _anvisaRegistration,
    _commercialCode,
    _productClassification,
    _internalClassification,
    _idProdutoEmultec,
    _price,
    _price17,
    _price18,
    _price20,
  ];

  /// What the form looked like when it opened, so closing can tell an edit from
  /// a look. See [CatalogUnsavedGuard].
  late final String _openedWith = _snapshot();

  String _snapshot() => [
    for (final controller in _controllers) controller.text,
    '$_isActive',
    '$_requiresSterilization',
    '${_brasindiceUpdatedAt?.toIso8601String()}',
    _selectedVerticalIds.join(','),
  ].join('\u0000');

  bool get _hasChanges => _snapshot() != _openedWith;

  /// Null until the answer arrives; see [CatalogDeleteButton].
  ProductDeletability? _deletability;

  @override
  void initState() {
    super.initState();
    // Re-validate on every keystroke so the "Salvar" button enables/
    // disables live instead of only after an unrelated rebuild.
    for (final controller in _controllers) {
      controller.addListener(_onFieldChanged);
    }
    if (_isEditing) _loadDeletability();
  }

  Future<void> _pickPicture(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: source,
      // Catalogue pictures are shown at thumbnail and card sizes; a 12 MP
      // camera original would be rejected by the 5 MB limit for no gain.
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 85,
    );
    if (picked == null || !mounted) return;

    setState(() => _pictureBusy = true);
    try {
      final bytes = await picked.readAsBytes();
      final saved = await ref
          .read(catalogRepositoryProvider)
          .uploadProductPicture(
            widget.existing!.id,
            filename: picked.name,
            bytes: bytes,
            contentType: _contentTypeFor(picked.name, picked.mimeType),
          );
      invalidateCatalog(ref);
      if (!mounted) return;
      setState(() {
        _pictureUrl = saved.url;
        _pictureBlurhash = saved.blurhash;
        _pictureBusy = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _pictureBusy = false);
      showCatalogSnack(
        context,
        error is CatalogApiException
            ? error.message
            : 'Não foi possível enviar a imagem.',
        isError: true,
      );
    }
  }

  /// The picker reports the MIME type on some platforms and not others, so the
  /// extension is the fallback. Sending the wrong one is a 422 from a route
  /// that only accepts JPEG, PNG and WebP.
  String _contentTypeFor(String name, String? mimeType) {
    if (mimeType != null && mimeType.startsWith('image/')) return mimeType;
    final extension = name.toLowerCase().split('.').last;
    return switch (extension) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => 'image/jpeg',
    };
  }

  Future<void> _removePicture() async {
    setState(() => _pictureBusy = true);
    try {
      await ref
          .read(catalogRepositoryProvider)
          .removeProductPicture(widget.existing!.id);
      invalidateCatalog(ref);
      if (!mounted) return;
      setState(() {
        _pictureUrl = null;
        _pictureBlurhash = null;
        _pictureBusy = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _pictureBusy = false);
      showCatalogSnack(
        context,
        error is CatalogApiException
            ? error.message
            : 'Não foi possível remover a imagem.',
        isError: true,
      );
    }
  }

  void _openPictureOptions() {
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Escolher da galeria'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickPicture(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Tirar foto'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickPicture(ImageSource.camera);
              },
            ),
            if (_pictureUrl != null)
              ListTile(
                leading: const Icon(
                  Icons.delete_outline_rounded,
                  color: AppColors.error,
                ),
                title: const Text(
                  'Remover imagem',
                  style: TextStyle(color: AppColors.error),
                ),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _removePicture();
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _loadDeletability() async {
    try {
      final answer = await ref
          .read(catalogRepositoryProvider)
          .getProductDeletability(widget.existing!.id);
      if (!mounted) return;
      setState(() => _deletability = answer);
    } catch (_) {
      // A failed check leaves delete unavailable rather than assuming either
      // answer. Nothing else on the form depends on it.
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
      await ref.read(catalogRepositoryProvider).deleteVariant(existing.id);
      invalidateCatalog(ref, variantId: existing.id);
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

  /// What the API actually requires (spec 0016 §5.1): a name, a manufacturer, a
  /// country, at least one Linha, and prices that parse.
  ///
  /// Not `code`, `familyName` or the three pricing-table codes: those are
  /// nullable by correctness (spec 0013 §2), and requiring them here is what
  /// forced synthetic values into the catalogue in the first place. An empty
  /// field is saved as `null`.
  bool get _isValid =>
      _name.text.trim().isNotEmpty &&
      _manufacturer.text.trim().isNotEmpty &&
      _countryOfOrigin.text.trim().isNotEmpty &&
      _selectedVerticalIds.isNotEmpty &&
      _pricesParse &&
      _emultecIdParses;

  /// The families worth offering for what has been typed so far.
  ///
  /// Nothing until there is something to match on — an empty field means the
  /// admin has not decided, and a wall of chips is not a decision aid. Capped,
  /// because a match on "R" is still most of the catalogue.
  List<String> _familySuggestions(List<String> all) {
    final query = _familyName.text.trim().toLowerCase();
    if (query.isEmpty) return const [];
    return all
        .where(
          (name) =>
              name.toLowerCase().contains(query) && name != _familyName.text,
        )
        .take(4)
        .toList();
  }

  /// What is still missing, named in the order the fields appear, so the
  /// sentence points down the form rather than listing everything at once.
  String? get _missing {
    if (_name.text.trim().isEmpty) return 'Informe o nome do produto.';
    if (_manufacturer.text.trim().isEmpty) return 'Informe o fabricante.';
    if (_countryOfOrigin.text.trim().isEmpty) return 'Informe o país.';
    if (!_pricesParse) return 'Revise os preços: algum campo não é um número.';
    if (!_emultecIdParses) return 'O ID Emultec precisa ser um número.';
    if (_selectedVerticalIds.isEmpty) {
      return 'Escolha ao menos uma linha comercial.';
    }
    return null;
  }

  /// A blank price field means zero, which is what the column already holds for
  /// products nobody has priced. Text that is *not* a number is a mistake.
  bool get _pricesParse => [
    _price,
    _price17,
    _price18,
    _price20,
  ].every((c) => c.text.trim().isEmpty || parseBrlNumber(c.text) != null);

  bool get _emultecIdParses {
    final text = _idProdutoEmultec.text.trim();
    return text.isEmpty || int.tryParse(text) != null;
  }

  void _toggleSector(int verticalId) {
    // Linhas are chosen once (spec 0016 §6.7); on an existing product they are
    // not rendered as chips at all, so this is unreachable there.
    if (_isEditing) return;
    setState(() {
      if (_selectedVerticalIds.contains(verticalId)) {
        _selectedVerticalIds.remove(verticalId);
      } else {
        _selectedVerticalIds.add(verticalId);
      }
    });
  }

  Future<void> _pickBrasindiceDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _brasindiceUpdatedAt ?? now,
      firstDate: DateTime(2000),
      lastDate: DateTime(now.year + 1, 12, 31),
    );
    if (picked == null) return;
    setState(() => _brasindiceUpdatedAt = picked);
  }

  Future<void> _submit() async {
    if (!_isValid || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    String? optional(TextEditingController controller) {
      final text = controller.text.trim();
      return text.isEmpty ? null : text;
    }

    double price(TextEditingController controller) =>
        parseBrlNumber(controller.text) ?? 0;

    final base = widget.existing ?? _blankVariant();
    final draft = CatalogVariant(
      id: base.id,
      // Rebuilt field by field rather than `copyWith`, because every optional
      // column here has to be able to go back to null — and in a `copyWith`,
      // null means "leave it alone".
      code: _code.text.trim(),
      name: _name.text.trim(),
      familyName: _familyName.text.trim(),
      presentation: _presentation.text.trim(),
      manufacturer: _manufacturer.text.trim(),
      countryOfOrigin: _countryOfOrigin.text.trim(),
      simproCode: _simproCode.text.trim(),
      brasindiceCode: _brasindiceCode.text.trim(),
      tissCode: _tissCode.text.trim(),
      price: price(_price),
      price17: price(_price17),
      price18: price(_price18),
      price20: price(_price20),
      // The admin's date, not `DateTime.now()`. This field records when the
      // *Brasíndice* record was published; stamping today on every save turned
      // it into "when someone last opened this form".
      brasindiceUpdatedAt: _brasindiceUpdatedAt,
      isActive: _isActive,
      // Ignored by `PATCH` (spec 0016 §6.7); sent only on create.
      verticalIds: _selectedVerticalIds.toList(),
      productGroup: optional(_familyName),
      description: optional(_description),
      brand: optional(_brand),
      unit: optional(_unit),
      barcode: optional(_barcode),
      ncm: optional(_ncm),
      anvisaRegistration: optional(_anvisaRegistration),
      commercialCode: optional(_commercialCode),
      internalClassification: optional(_internalClassification),
      productClassification: optional(_productClassification),
      requiresSterilization: _requiresSterilization,
      idProdutoEmultec: int.tryParse(_idProdutoEmultec.text.trim()),
      metricUnits: base.metricUnits,
    );

    try {
      final repository = ref.read(catalogRepositoryProvider);
      final saved = _isEditing
          ? await repository.updateVariant(draft)
          : await repository.createVariant(draft);
      invalidateCatalog(ref, variantId: saved.id);
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

  CatalogVariant _blankVariant() => CatalogVariant(
    id: 0,
    code: '',
    name: '',
    familyName: '',
    presentation: '',
    manufacturer: '',
    countryOfOrigin: '',
    simproCode: '',
    brasindiceCode: '',
    tissCode: '',
    price: 0,
    price17: 0,
    price18: 0,
    price20: 0,
    // Null, not `now()`: a new product has no Brasíndice record until someone
    // says it does.
    brasindiceUpdatedAt: null,
    verticalIds: const [],
  );

  @override
  Widget build(BuildContext context) {
    final sectorsAsync = ref.watch(catalogVerticalsProvider);
    final familyNames = <String>{
      for (final family in widget.families) family.name,
    }.toList()..sort();
    // The family carries the *table* publication dates, which are a different
    // thing from this product's `brasindiceUpdatedAt` and were previously only
    // visible in the quick-view sheet this screen replaced.
    final family = _isEditing
        ? widget.families
              .where(
                (candidate) =>
                    candidate.variants.any((v) => v.id == widget.existing!.id),
              )
              .firstOrNull
        : null;

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
                    const CatalogFieldLabel('Imagem'),
                    const SizedBox(height: 6),
                    _PictureField(
                      // A new product has no id yet, and the upload route takes
                      // one. Rather than buffer the bytes through the save, the
                      // section says what to do — the alternative is a form that
                      // accepts a picture and silently drops it.
                      enabled: _isEditing,
                      busy: _pictureBusy,
                      pictureUrl: _pictureUrl,
                      blurhash: _pictureBlurhash,
                      onTap: _openPictureOptions,
                    ),
                    const SizedBox(height: 16),
                    const CatalogFieldLabel('Nome do produto'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _name,
                      hint: 'Ex.: REVISCON 1.0%',
                      capitalization: TextCapitalization.words,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('Código'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _code,
                                hint: 'REV-1.0',
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('Apresentação'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _presentation,
                                hint: '20MG / 2ML',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const CatalogFieldLabel('Família'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _familyName,
                      hint: 'Ex.: REVISCON',
                      capitalization: TextCapitalization.characters,
                    ),
                    // Suggestions, not a catalogue. Every existing family used
                    // to render unconditionally: on a new product that is
                    // twelve chips of 70-character product names — `familyName`
                    // falls back to `name` when `product_group` is null, which
                    // it is for every imported row — filling the screen between
                    // Família and the fields under it.
                    if (_familySuggestions(familyNames).isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final name in _familySuggestions(familyNames))
                            _SuggestionChip(
                              label: name,
                              onTap: () => setState(() {
                                _familyName.text = name;
                              }),
                            ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 16),
                    const CatalogFieldLabel('Descrição'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _description,
                      hint: 'Opcional',
                      capitalization: TextCapitalization.sentences,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('Marca'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _brand,
                                hint: 'Opcional',
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('Classificação'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _productClassification,
                                hint: 'Opcional',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const CatalogFieldLabel('Classificação interna'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _internalClassification,
                      hint: 'Opcional',
                    ),
                    const SizedBox(height: 16),
                    const CatalogFieldLabel('Linhas comerciais'),
                    const SizedBox(height: 6),
                    if (_isEditing)
                      // Spec 0016 §6.7: chosen once. Orders key on
                      // `facility_vertical_profile_id` and `product_potential_links`
                      // is unique per (product, vertical), so a move silently
                      // changes which profiles this product's sales join to and
                      // orphans its metric link. Shown, with the reason, rather
                      // than hidden — an admin looking for it deserves an answer.
                      sectorsAsync.when(
                        loading: () => const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        error: (_, _) => const Text(
                          'Não foi possível carregar as linhas comerciais.',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: AppColors.error,
                          ),
                        ),
                        data: (sectors) {
                          final names = sectors
                              .where((s) => _selectedVerticalIds.contains(s.id))
                              .map((s) => s.name)
                              .join(' · ');
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                names.isEmpty ? '—' : names,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.gray900,
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                'A linha de um produto é definida no cadastro e '
                                'não pode ser alterada: os pedidos já registrados '
                                'estão ligados a ela.',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.gray400,
                                ),
                              ),
                            ],
                          );
                        },
                      )
                    else
                      sectorsAsync.when(
                        loading: () => const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                        error: (_, _) => const Text(
                          'Não foi possível carregar as linhas comerciais.',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: AppColors.error,
                          ),
                        ),
                        data: (sectors) => sectors.isEmpty
                            ? const Text(
                                'Nenhuma linha comercial cadastrada.',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: AppColors.gray400,
                                ),
                              )
                            : Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  for (final sector in sectors)
                                    _SuggestionChip(
                                      label: sector.name,
                                      selected: _selectedVerticalIds.contains(
                                        sector.id,
                                      ),
                                      onTap: () => _toggleSector(sector.id),
                                    ),
                                ],
                              ),
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
                                hint: 'VSY',
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
                                hint: 'Alemanha',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    CatalogActiveSwitch(
                      value: _requiresSterilization,
                      label: 'Requer esterilização',
                      onChanged: (value) =>
                          setState(() => _requiresSterilization = value),
                      explanation:
                          'Marque para produtos que passam por autoclave antes '
                          'do uso.',
                    ),
                    const SizedBox(height: 12),
                    const CatalogSectionLabel('CÓDIGOS'),
                    const SizedBox(height: 4),
                    const Text(
                      'Todos opcionais. Um campo vazio é salvo como “sem código” '
                      '— não invente um valor para preencher.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray400,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const CatalogFieldLabel('SIMPRO'),
                    const SizedBox(height: 6),
                    CatalogTextInput(controller: _simproCode, hint: '00308555'),
                    const SizedBox(height: 16),
                    const CatalogFieldLabel('BRASÍNDICE'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _brasindiceCode,
                      hint: '024847',
                    ),
                    const SizedBox(height: 10),
                    // The date the Brasíndice record was published — not the date
                    // someone saved this form, which is what it used to record.
                    _DateField(
                      label: 'Publicação Brasíndice',
                      value: _brasindiceUpdatedAt,
                      onPick: _pickBrasindiceDate,
                      onClear: _brasindiceUpdatedAt == null
                          ? null
                          : () => setState(() => _brasindiceUpdatedAt = null),
                    ),
                    const SizedBox(height: 16),
                    const CatalogFieldLabel('TISS'),
                    const SizedBox(height: 6),
                    CatalogTextInput(controller: _tissCode, hint: '0000094527'),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('EAN / código de barras'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _barcode,
                                hint: '7891234567890',
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('NCM'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _ncm,
                                hint: '3006.10.19',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('Registro ANVISA'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _anvisaRegistration,
                                hint: 'Opcional',
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const CatalogFieldLabel('Código comercial'),
                              const SizedBox(height: 6),
                              CatalogTextInput(
                                controller: _commercialCode,
                                hint: 'Opcional',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const CatalogFieldLabel('ID do produto no Emultec'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _idProdutoEmultec,
                      hint: 'Somente números',
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'É por este id que o importador de pedidos reconhece o '
                      'produto. Um pedido do Emultec que cita um id não '
                      'cadastrado fica retido até o produto existir aqui.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray400,
                      ),
                    ),
                    const SizedBox(height: 20),
                    const CatalogSectionLabel('UNIDADES'),
                    const SizedBox(height: 10),
                    const CatalogFieldLabel('Unidade'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _unit,
                      hint: 'Ex.: caixa, ampola',
                    ),
                    const SizedBox(height: 12),
                    // Read-only by decision (spec 0016 §7.1). Shown rather than
                    // hidden, because the number is already used in reads and an
                    // admin who cannot see it cannot notice it is wrong.
                    _ReadOnlyRow(
                      label: 'Unidades da métrica',
                      value: brlNumber(widget.existing?.metricUnits ?? 1),
                      note:
                          'Quantas unidades da métrica valem uma unidade deste '
                          'produto. Informativo: o cálculo de potencial usa as '
                          'quantidades brutas, e este campo não é editável.',
                    ),
                    const SizedBox(height: 20),
                    const CatalogSectionLabel('PREÇOS'),
                    const SizedBox(height: 10),
                    const CatalogFieldLabel('Preço de tabela'),
                    const SizedBox(height: 6),
                    CatalogTextInput(
                      controller: _price,
                      hint: '0,00',
                      keyboardType: TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                    const SizedBox(height: 16),
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
                    if (_isEditing) ...[
                      const SizedBox(height: 20),
                      const CatalogSectionLabel('RELACIONADOS'),
                      const SizedBox(height: 4),
                      _LinkRow(
                        icon: Icons.storefront_outlined,
                        label: 'Produtos concorrentes',
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ManageCompetitorsScreen(
                              variantId: widget.existing!.id,
                              variantLabel: widget.existing!.comparisonLabel,
                            ),
                          ),
                        ),
                      ),
                      _LinkRow(
                        icon: Icons.bar_chart_rounded,
                        label: 'Ver comparativo de preços',
                        onTap: () => CatalogComparisonRoute(
                          variantId: widget.existing!.id,
                        ).push(context),
                      ),
                      if (family != null) ...[
                        const SizedBox(height: 12),
                        _PublicationFooter(
                          brasindiceDate: family.brasindicePublishedAt,
                          simproDate: family.simproPublishedAt,
                        ),
                      ],
                    ],
                    const SizedBox(height: 20),
                    const CatalogSectionLabel('ESTADO'),
                    CatalogActiveSwitch(
                      value: _isActive,
                      onChanged: (value) => setState(() => _isActive = value),
                      explanation:
                          'Um produto inativo some das listas dos representantes '
                          'e dos pedidos novos. Os pedidos e as métricas já '
                          'registrados continuam válidos.',
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

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.value,
    required this.onPick,
    this.onClear,
  });

  final String label;
  final DateTime? value;
  final VoidCallback onPick;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CatalogFieldLabel(label),
              const SizedBox(height: 4),
              Text(
                value == null ? 'Sem data' : formatDate(value!),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: value == null ? AppColors.gray400 : AppColors.gray900,
                ),
              ),
            ],
          ),
        ),
        if (onClear != null)
          IconButton(
            tooltip: 'Limpar',
            onPressed: onClear,
            icon: const Icon(Icons.close_rounded, size: 18),
            color: AppColors.gray400,
          ),
        TextButton(onPressed: onPick, child: const Text('Escolher')),
      ],
    );
  }
}

/// A value the form shows but never lets anyone change, with the reason.
class _ReadOnlyRow extends StatelessWidget {
  const _ReadOnlyRow({
    required this.label,
    required this.value,
    required this.note,
  });

  final String label;
  final String value;
  final String note;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceSecondary,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              CatalogFieldLabel(label),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            note,
            style: const TextStyle(fontSize: 11.5, color: AppColors.gray400),
          ),
        ],
      ),
    );
  }
}

class _SuggestionChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final bool selected;

  const _SuggestionChip({
    required this.label,
    required this.onTap,
    this.selected = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.navyDeep : AppColors.gray100,
      borderRadius: BorderRadius.circular(99),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(99),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: ConstrainedBox(
            // A chip is a glance, not a paragraph. Family names run to 70
            // characters here, and an unbounded one wrapped to three lines.
            constraints: const BoxConstraints(maxWidth: 220),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : AppColors.gray700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The product picture: a tappable thumbnail that is also the empty state.
///
/// Saved on selection rather than on "Salvar" — it is a separate endpoint and
/// a separate object in storage, and a picture that vanished because the admin
/// backed out of an unrelated field is worse than one saved a moment early.
class _PictureField extends StatelessWidget {
  const _PictureField({
    required this.enabled,
    required this.busy,
    required this.pictureUrl,
    required this.blurhash,
    required this.onTap,
  });

  final bool enabled;
  final bool busy;
  final String? pictureUrl;
  final String? blurhash;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final url = pictureUrl?.trim();
    final hasImage = url != null && url.isNotEmpty;

    return Row(
      children: [
        busy
            ? Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  color: AppColors.surfaceSecondary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              )
            : ProductThumbnail(
                pictureUrl: pictureUrl,
                blurhash: blurhash,
                size: 84,
                borderRadius: 12,
                placeholderIconSize: 28,
              ),
        const SizedBox(width: 12),
        Expanded(
          child: enabled
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextButton(
                      onPressed: busy ? null : onTap,
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(
                        hasImage ? 'Trocar imagem' : 'Adicionar imagem',
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.navyDeep,
                        ),
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'JPG, PNG ou WebP, até 5 MB. Salva na hora, sem esperar '
                      'o botão Salvar.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray400,
                      ),
                    ),
                  ],
                )
              : const Text(
                  'Salve o produto primeiro; depois a imagem pode ser enviada '
                  'por aqui.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.gray400),
                ),
        ),
      ],
    );
  }
}

/// When the Brasíndice/Simpro tables for this product's *family* were last
/// published — a different thing from this product's own `brasindiceUpdatedAt`
/// field above.
///
/// Read-only. It carried an "editar publicação" pencil that only raised a
/// "coming soon" snackbar; inside a form where every other pencil writes, that
/// is worse than no button.
class _PublicationFooter extends StatelessWidget {
  /// Null when the family ships without a Brasíndice/Simpro record.
  final DateTime? brasindiceDate;
  final DateTime? simproDate;

  const _PublicationFooter({
    required this.brasindiceDate,
    required this.simproDate,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'PUBLICAÇÃO',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray400,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Brasíndice: ${brasindiceDate == null ? '—' : formatDate(brasindiceDate!)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.gray500,
                  ),
                ),
                Text(
                  'Simpro: ${simproDate == null ? '—' : formatDate(simproDate!)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.gray500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A navigation row inside the form — the two places an admin goes *from* a
/// product without leaving the product.
class _LinkRow extends StatelessWidget {
  const _LinkRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Icon(icon, size: 18, color: AppColors.navyDeep),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.navyDeep,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: AppColors.gray400,
            ),
          ],
        ),
      ),
    );
  }
}
