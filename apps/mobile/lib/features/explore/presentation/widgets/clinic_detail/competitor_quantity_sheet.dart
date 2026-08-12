import 'package:atlasmed_mobile_app/features/catalog/data/models/competitor_product.dart';
import 'package:atlasmed_mobile_app/features/catalog/data/repositories/catalog_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_potential_repository.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Records what a clinic uses of one competitor product, for one metric.
///
/// The rep supplies **only a number** (spec 0013 §4.1). The product comes from
/// the picker and the linha comes from the definition, so a usage row can never
/// pair a profile in one linha with a metric in another — that invariant is the
/// server's, and this screen simply has no way to express the wrong thing.
///
/// The quantity is in *product units*, exactly as printed on the box. It is
/// multiplied by the product's `metric_units` on read, symmetric with how our
/// own order lines are counted, so the rep never does arithmetic in their head.
class CompetitorQuantitySheet extends StatefulWidget {
  const CompetitorQuantitySheet({
    super.key,
    required this.definitionLabel,
    required this.repository,
    required this.definitionId,
    this.existing,
    this.catalogRepository,
  });

  final String definitionLabel;
  final FacilityPotentialRepository repository;
  final int definitionId;

  /// Present when editing a quantity that is already recorded.
  final CompetitorUsage? existing;

  /// Injectable so the sheet can be driven in tests without a network.
  final CatalogRepository? catalogRepository;

  @override
  State<CompetitorQuantitySheet> createState() =>
      _CompetitorQuantitySheetState();
}

class _CompetitorQuantitySheetState extends State<CompetitorQuantitySheet> {
  late final CatalogRepository _catalog =
      widget.catalogRepository ?? CatalogRepository();
  late final TextEditingController _quantity = TextEditingController(
    text: widget.existing == null ? '' : _fmt(widget.existing!.quantity),
  );

  List<CompetitorProduct> _products = const [];
  int? _selectedProductId;
  bool _loadingProducts = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedProductId = widget.existing?.productId;
    _loadProducts();
  }

  @override
  void dispose() {
    _quantity.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    try {
      final products = await _catalog.getAllCompetitorProducts();
      if (!mounted) return;
      setState(() {
        _products = products;
        _loadingProducts = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingProducts = false;
        // Named, not swallowed: without the list there is nothing to pick, and
        // a silent empty picker reads as "no competitors exist".
        _error = 'Não foi possível carregar os produtos de outras marcas.';
      });
    }
  }

  Future<void> _save() async {
    final productId = _selectedProductId;
    if (productId == null) {
      setState(() => _error = 'Selecione um produto de outra marca.');
      return;
    }
    final quantity = double.tryParse(
      _quantity.text.trim().replaceAll(',', '.'),
    );
    // Strictly positive (§4.6). Zero is not a quantity: "não vendem aqui" is
    // the "Nenhuma outra marca" option on the section, which records who said
    // it and when.
    if (quantity == null || quantity <= 0) {
      setState(
        () => _error = quantity == 0
            ? 'Para dizer que não há outras marcas, use a opção '
                  '"Nenhuma outra marca".'
            : 'Informe uma quantidade válida.',
      );
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final page = await widget.repository.setCompetitorQuantity(
        definitionId: widget.definitionId,
        productId: productId,
        quantity: quantity,
      );
      if (!mounted) return;
      // The server returns the recomputed page, so the caller refreshes from
      // the response rather than re-fetching and risking a different answer.
      Navigator.of(context).pop(page);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is FacilityPotentialException
            ? error.message
            : 'Não foi possível salvar a quantidade.';
      });
    }
  }

  /// Removes this competitor product from the metric.
  ///
  /// The product picker is deliberately locked while editing — a different
  /// product is a different row, not an edit — so removal is the only way to
  /// correct a row recorded against the wrong product. Without it the rep's
  /// only escape is a quantity of 0, which is a claim about the clinic
  /// ("uses none") rather than the absence of one.
  Future<void> _remove() async {
    final existing = widget.existing;
    if (existing == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remover outra marca?'),
        content: Text(
          '${existing.productName} deixa de contar neste cálculo. Para '
          'registrar que a clínica passou a usar menos, edite a quantidade '
          'em vez de remover.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Remover'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final page = await widget.repository.removeCompetitor(
        definitionId: widget.definitionId,
        productId: existing.productId,
      );
      if (!mounted) return;
      Navigator.of(context).pop(page);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error is FacilityPotentialException
            ? error.message
            : 'Não foi possível remover a marca.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SafeArea(
        top: false,
        // Scrollable because the keyboard is open for most of this sheet's
        // life: with the inset applied the actions at the bottom would
        // otherwise sit below the viewport, present but untappable.
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.gray100,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                widget.existing == null
                    ? 'Adicionar outra marca'
                    : 'Editar quantidade',
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.navyDeep,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.definitionLabel,
                style: const TextStyle(fontSize: 13, color: AppColors.gray500),
              ),
              const SizedBox(height: 16),
              if (_loadingProducts)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 20),
                  child: Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              else
                DropdownButtonFormField<int>(
                  key: const Key('competitor-product-picker'),
                  initialValue: _selectedProductId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Produto de outra marca',
                    border: OutlineInputBorder(),
                  ),
                  items: [
                    for (final product in _products)
                      DropdownMenuItem(
                        value: product.id,
                        child: Text(
                          product.name,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  // Editing an existing row must not let the rep change which
                  // product it is — that is a different row, not an edit.
                  onChanged: widget.existing != null
                      ? null
                      : (value) => setState(() => _selectedProductId = value),
                ),
              const SizedBox(height: 12),
              TextField(
                key: const Key('competitor-quantity-field'),
                controller: _quantity,
                autofocus: widget.existing != null,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                decoration: InputDecoration(
                  labelText: 'Quantidade por mês',
                  // The list shows this product in metric units and this field
                  // takes packaging units, so the number here will not match the
                  // row that was just tapped. Saying so is cheaper than a rep
                  // deciding the figure was lost.
                  helperText: widget.existing == null
                      ? 'Na unidade da embalagem, como o rep a conhece.'
                      : 'Na unidade da embalagem. A lista mostra o total '
                            'convertido para a unidade da métrica.',
                  helperMaxLines: 3,
                  border: const OutlineInputBorder(),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(
                  _error!,
                  style: const TextStyle(fontSize: 13, color: AppColors.error),
                ),
              ],
              const SizedBox(height: 18),
              FilledButton(
                key: const Key('competitor-quantity-save'),
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Salvar'),
              ),
              if (widget.existing != null)
                TextButton(
                  key: const Key('competitor-quantity-remove'),
                  onPressed: _saving ? null : _remove,
                  style: TextButton.styleFrom(foregroundColor: AppColors.error),
                  child: const Text('Remover outra marca'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

String _fmt(double value) => value == value.roundToDouble()
    ? value.toStringAsFixed(0)
    : value.toString();
