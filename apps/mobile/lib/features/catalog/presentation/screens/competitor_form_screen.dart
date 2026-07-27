import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_api_exception.dart';
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

  @override
  void initState() {
    super.initState();
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
      _manufacturer.text.trim().isNotEmpty &&
      _countryOfOrigin.text.trim().isNotEmpty &&
      parseBrlNumber(_price17.text) != null &&
      parseBrlNumber(_price18.text) != null &&
      parseBrlNumber(_price20.text) != null;

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
      brasindiceUpdatedAt: DateTime.now(),
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
    id: '',
    name: '',
    manufacturer: '',
    countryOfOrigin: '',
    price17: 0,
    price18: 0,
    price20: 0,
    brasindiceUpdatedAt: DateTime.now(),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const AppColors.background,
      appBar: AppBar(
        backgroundColor: const AppColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: const AppColors.gray950,
        title: Text(
          _isEditing ? 'Editar concorrente' : 'Novo concorrente',
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
                  const _CompFieldLabel('Nome do produto'),
                  const SizedBox(height: 6),
                  _CompTextInput(
                    controller: _name,
                    hint: 'Ex.: SINGJOINT 24MG / 2ML',
                    capitalization: TextCapitalization.words,
                  ),
                  const SizedBox(height: 16),
                  const _CompFieldLabel('Marca (opcional)'),
                  const SizedBox(height: 6),
                  _CompTextInput(
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
                            const _CompFieldLabel('Fabricante'),
                            const SizedBox(height: 6),
                            _CompTextInput(
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
                            const _CompFieldLabel('País'),
                            const SizedBox(height: 6),
                            _CompTextInput(
                              controller: _countryOfOrigin,
                              hint: 'China',
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const _CompSectionLabel('PREÇOS'),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const _CompFieldLabel('ICMS 17%'),
                            const SizedBox(height: 6),
                            _CompTextInput(
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
                            const _CompFieldLabel('ICMS 18%'),
                            const SizedBox(height: 6),
                            _CompTextInput(
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
                            const _CompFieldLabel('ICMS 20%'),
                            const SizedBox(height: 6),
                            _CompTextInput(
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

class _CompFieldLabel extends StatelessWidget {
  final String text;
  const _CompFieldLabel(this.text);

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

class _CompSectionLabel extends StatelessWidget {
  final String text;
  const _CompSectionLabel(this.text);

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

class _CompTextInput extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final TextCapitalization capitalization;
  final TextInputType? keyboardType;

  const _CompTextInput({
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
