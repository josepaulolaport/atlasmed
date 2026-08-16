import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/product_deletability.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/widgets/catalog_delete_action.dart';
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is CatalogApiException
                ? error.message
                : 'Não foi possível enviar a imagem.',
          ),
        ),
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is CatalogApiException
                ? error.message
                : 'Não foi possível remover a imagem.',
          ),
        ),
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('${existing.name} excluído')));
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

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: AppColors.gray950,
        title: Text(
          _isEditing ? 'Editar produto' : 'Novo produto',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        actions: [
          if (_isEditing)
            CatalogDeleteButton(
              deletability: _deletability,
              onDelete: _delete,
              blockedTitle: 'Este produto não pode ser excluído',
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
                  const _FieldLabel('Imagem'),
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
                  const _FieldLabel('Nome do produto'),
                  const SizedBox(height: 6),
                  _TextInput(
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
                            const _FieldLabel('Código'),
                            const SizedBox(height: 6),
                            _TextInput(controller: _code, hint: 'REV-1.0'),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _FieldLabel('Apresentação'),
                            const SizedBox(height: 6),
                            _TextInput(
                              controller: _presentation,
                              hint: '20MG / 2ML',
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const _FieldLabel('Família'),
                  const SizedBox(height: 6),
                  _TextInput(
                    controller: _familyName,
                    hint: 'Ex.: REVISCON',
                    capitalization: TextCapitalization.characters,
                  ),
                  if (familyNames.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final name in familyNames)
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
                  const _FieldLabel('Descrição'),
                  const SizedBox(height: 6),
                  _TextInput(
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
                            const _FieldLabel('Marca'),
                            const SizedBox(height: 6),
                            _TextInput(controller: _brand, hint: 'Opcional'),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _FieldLabel('Classificação'),
                            const SizedBox(height: 6),
                            _TextInput(
                              controller: _productClassification,
                              hint: 'Opcional',
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const _FieldLabel('Classificação interna'),
                  const SizedBox(height: 6),
                  _TextInput(
                    controller: _internalClassification,
                    hint: 'Opcional',
                  ),
                  const SizedBox(height: 16),
                  const _FieldLabel('Linhas comerciais'),
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
                            const _FieldLabel('Fabricante'),
                            const SizedBox(height: 6),
                            _TextInput(controller: _manufacturer, hint: 'VSY'),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _FieldLabel('País'),
                            const SizedBox(height: 6),
                            _TextInput(
                              controller: _countryOfOrigin,
                              hint: 'Alemanha',
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: _requiresSterilization,
                    onChanged: (value) =>
                        setState(() => _requiresSterilization = value),
                    title: const Text(
                      'Requer esterilização',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray900,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const _SectionLabel('CÓDIGOS'),
                  const SizedBox(height: 4),
                  const Text(
                    'Todos opcionais. Um campo vazio é salvo como “sem código” '
                    '— não invente um valor para preencher.',
                    style: TextStyle(fontSize: 11.5, color: AppColors.gray400),
                  ),
                  const SizedBox(height: 10),
                  const _FieldLabel('SIMPRO'),
                  const SizedBox(height: 6),
                  _TextInput(controller: _simproCode, hint: '00308555'),
                  const SizedBox(height: 16),
                  const _FieldLabel('BRASÍNDICE'),
                  const SizedBox(height: 6),
                  _TextInput(controller: _brasindiceCode, hint: '024847'),
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
                  const _FieldLabel('TISS'),
                  const SizedBox(height: 6),
                  _TextInput(controller: _tissCode, hint: '0000094527'),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _FieldLabel('EAN / código de barras'),
                            const SizedBox(height: 6),
                            _TextInput(
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
                            const _FieldLabel('NCM'),
                            const SizedBox(height: 6),
                            _TextInput(controller: _ncm, hint: '3006.10.19'),
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
                            const _FieldLabel('Registro ANVISA'),
                            const SizedBox(height: 6),
                            _TextInput(
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
                            const _FieldLabel('Código comercial'),
                            const SizedBox(height: 6),
                            _TextInput(
                              controller: _commercialCode,
                              hint: 'Opcional',
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const _FieldLabel('ID do produto no Emultec'),
                  const SizedBox(height: 6),
                  _TextInput(
                    controller: _idProdutoEmultec,
                    hint: 'Somente números',
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'É por este id que o importador de pedidos reconhece o '
                    'produto. Um pedido do Emultec que cita um id não '
                    'cadastrado fica retido até o produto existir aqui.',
                    style: TextStyle(fontSize: 11.5, color: AppColors.gray400),
                  ),
                  const SizedBox(height: 20),
                  const _SectionLabel('UNIDADES'),
                  const SizedBox(height: 10),
                  const _FieldLabel('Unidade'),
                  const SizedBox(height: 6),
                  _TextInput(controller: _unit, hint: 'Ex.: caixa, ampola'),
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
                  const _SectionLabel('PREÇOS'),
                  const SizedBox(height: 10),
                  const _FieldLabel('Preço de tabela'),
                  const SizedBox(height: 6),
                  _TextInput(
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
                            const _FieldLabel('ICMS 17%'),
                            const SizedBox(height: 6),
                            _TextInput(
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
                            const _FieldLabel('ICMS 18%'),
                            const SizedBox(height: 6),
                            _TextInput(
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
                            const _FieldLabel('ICMS 20%'),
                            const SizedBox(height: 6),
                            _TextInput(
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
                    const _SectionLabel('RELACIONADOS'),
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
                  const _SectionLabel('ESTADO'),
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
                        color: AppColors.gray900,
                      ),
                    ),
                    subtitle: const Text(
                      'Um produto inativo some das listas dos representantes e '
                      'dos pedidos novos. Os pedidos e as métricas já '
                      'registrados continuam válidos.',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: AppColors.gray400,
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
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

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.gray400,
        letterSpacing: 0.5,
      ),
    );
  }
}

class _TextInput extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final TextCapitalization capitalization;
  final TextInputType? keyboardType;

  const _TextInput({
    required this.controller,
    required this.hint,
    this.capitalization = TextCapitalization.none,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      textCapitalization: capitalization,
      keyboardType: keyboardType,
      style: const TextStyle(fontSize: 14, color: AppColors.gray900),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.gray400),
        filled: true,
        fillColor: Colors.white,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 14,
        ),
        border: const OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          borderSide: BorderSide(color: AppColors.gray200),
        ),
      ),
    );
  }
}

/// A date the admin picks, with a way to clear it. Used for the Brasíndice
/// publication date, which is nullable because the code it belongs to is.
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
              _FieldLabel(label),
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
              _FieldLabel(label),
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
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : AppColors.gray700,
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
