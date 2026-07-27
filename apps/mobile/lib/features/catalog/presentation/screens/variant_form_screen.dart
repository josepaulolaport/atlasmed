import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_family.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/models/catalog_variant.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
import 'package:atlasmed_mobile_app/features/catalog/presentation/providers/catalog_providers.dart';
import 'package:atlasmed_mobile_app/features/orders/data/models/formatting.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Admin-only full-screen form for creating a new AtlasMed product variant
/// or editing an existing one — mirrors [TerritoryInfoForm]'s shape
/// (fullscreen dialog, labeled fields, bottom "Salvar" bar) so every
/// admin-mutation form in the app reads the same way.
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

  late final Set<String> _selectedVerticalIds = {
    ...widget.existing?.verticalIds ?? [],
  };

  bool _saving = false;
  String? _error;

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
    _price,
    _price17,
    _price18,
    _price20,
  ];

  @override
  void initState() {
    super.initState();
    // Re-validate on every keystroke so the "Salvar" button enables/
    // disables live instead of only after an unrelated rebuild.
    for (final controller in _controllers) {
      controller.addListener(_onFieldChanged);
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
      _code.text.trim().isNotEmpty &&
      _familyName.text.trim().isNotEmpty &&
      _manufacturer.text.trim().isNotEmpty &&
      _countryOfOrigin.text.trim().isNotEmpty &&
      _selectedVerticalIds.isNotEmpty &&
      parseBrlNumber(_price.text) != null &&
      parseBrlNumber(_price17.text) != null &&
      parseBrlNumber(_price18.text) != null &&
      parseBrlNumber(_price20.text) != null;

  void _toggleSector(String verticalId) {
    setState(() {
      if (_selectedVerticalIds.contains(verticalId)) {
        _selectedVerticalIds.remove(verticalId);
      } else {
        _selectedVerticalIds.add(verticalId);
      }
    });
  }

  Future<void> _submit() async {
    if (!_isValid || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final draft = (widget.existing ?? _blankVariant()).copyWith(
      name: _name.text.trim(),
      code: _code.text.trim(),
      familyName: _familyName.text.trim(),
      presentation: _presentation.text.trim(),
      manufacturer: _manufacturer.text.trim(),
      countryOfOrigin: _countryOfOrigin.text.trim(),
      simproCode: _simproCode.text.trim(),
      brasindiceCode: _brasindiceCode.text.trim(),
      tissCode: _tissCode.text.trim(),
      price: parseBrlNumber(_price.text),
      price17: parseBrlNumber(_price17.text),
      price18: parseBrlNumber(_price18.text),
      price20: parseBrlNumber(_price20.text),
      brasindiceUpdatedAt: DateTime.now(),
      verticalIds: _selectedVerticalIds.toList(),
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
    id: '',
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
    brasindiceUpdatedAt: DateTime.now(),
    verticalIds: const [],
  );

  @override
  Widget build(BuildContext context) {
    final sectorsAsync = ref.watch(catalogVerticalsProvider);
    final familyNames = <String>{
      for (final family in widget.families) family.name,
    }.toList()..sort();

    return Scaffold(
      backgroundColor: const AppColors.background,
      appBar: AppBar(
        backgroundColor: const AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: const Color(0xFF111827),
        title: Text(
          _isEditing ? 'Editar produto' : 'Novo produto',
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
                  const _FieldLabel('Verticais'),
                  const SizedBox(height: 6),
                  sectorsAsync.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                    error: (_, _) => Text(
                      'Não foi possível carregar os verticais.',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFFdc2626),
                      ),
                    ),
                    data: (sectors) => sectors.isEmpty
                        ? const Text(
                            'Nenhum vertical cadastrado.',
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
                  const SizedBox(height: 20),
                  const _SectionLabel('CÓDIGOS'),
                  const SizedBox(height: 10),
                  const _FieldLabel('SIMPRO'),
                  const SizedBox(height: 6),
                  _TextInput(controller: _simproCode, hint: '00308555'),
                  const SizedBox(height: 16),
                  const _FieldLabel('BRASÍNDICE'),
                  const SizedBox(height: 6),
                  _TextInput(controller: _brasindiceCode, hint: '024847'),
                  const SizedBox(height: 16),
                  const _FieldLabel('TISS'),
                  const SizedBox(height: 6),
                  _TextInput(controller: _tissCode, hint: '0000094527'),
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
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _error!,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFFdc2626),
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
                  backgroundColor: const AppColors.navyDeep,
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
          borderSide: BorderSide(color: Color(0xFFE1E4EA)),
        ),
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
      color: selected ? const AppColors.navyDeep : const AppColors.gray100,
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
              color: selected ? Colors.white : const AppColors.gray700,
            ),
          ),
        ),
      ),
    );
  }
}
