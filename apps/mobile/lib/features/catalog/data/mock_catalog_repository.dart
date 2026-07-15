import 'catalog_models.dart';
import 'catalog_repository.dart';

class MockCatalogRepository implements CatalogRepository {
  @override
  Future<List<ProductFamily>> getProductFamilies() async {
    await Future.delayed(const Duration(milliseconds: 500));
    return _families;
  }

  @override
  Future<ProductFamily> getProductFamily(String id) async {
    await Future.delayed(const Duration(milliseconds: 400));
    return _families.firstWhere(
      (f) => f.id == id,
      orElse: () => _families.first,
    );
  }

  @override
  Future<List<PriceTableGroup>> getPriceTable() async {
    await Future.delayed(const Duration(milliseconds: 500));
    return _priceTable;
  }
}

// ── Product families ──────────────────────────────────────────
final _families = <ProductFamily>[
  ProductFamily(
    id: 'reviscon',
    name: 'REVISCON',
    originFlagEmoji: '🇩🇪',
    brasindicePublishedAt: DateTime(2025, 6, 5),
    simproPublishedAt: DateTime(2025, 5, 19),
    variants: const [
      ProductVariant(
        name: 'REVISCON 1.0%',
        simproCode: '00308555',
        brasindiceCode: '024847',
        tissCode: '0000094527',
        price: 1840.00,
      ),
      ProductVariant(
        name: 'REVISCON PLUS 1.6%',
        simproCode: '00308556',
        brasindiceCode: '024848',
        tissCode: '0000094529',
        price: 3175.00,
      ),
      ProductVariant(
        name: 'REVISCON MONO 2.0%',
        simproCode: '00312308',
        brasindiceCode: '025122',
        tissCode: '0000094528',
        price: 5150.00,
      ),
    ],
  ),
  ProductFamily(
    id: 'evisc',
    name: 'EVISC',
    originFlagEmoji: '🇩🇪',
    brasindicePublishedAt: DateTime(2025, 2, 21),
    simproPublishedAt: DateTime(2025, 2, 19),
    variants: const [
      ProductVariant(
        name: 'EVISC 1.0%',
        simproCode: '0359468',
        brasindiceCode: '028066',
        tissCode: '0000092109',
        price: 2855.00,
      ),
      ProductVariant(
        name: 'EVISC PLUS 1.6%',
        simproCode: '0359469',
        brasindiceCode: '028067',
        tissCode: '0000092110',
        price: 4650.00,
      ),
      ProductVariant(
        name: 'EVISC MORE 2.0%',
        simproCode: '0359470',
        brasindiceCode: '028068',
        tissCode: '0000092111',
        price: 5650.00,
      ),
    ],
  ),
  ProductFamily(
    id: 'truvisc',
    name: 'TRUVISC',
    originFlagEmoji: '🇩🇪',
    brasindicePublishedAt: DateTime(2025, 2, 21),
    simproPublishedAt: DateTime(2025, 2, 19),
    variants: const [
      ProductVariant(
        name: 'TRUVISC 1.0%',
        simproCode: '0359465',
        brasindiceCode: '028063',
        tissCode: '0000092106',
        price: 2900.00,
      ),
      ProductVariant(
        name: 'TRUVISC 1.6%',
        simproCode: '0359466',
        brasindiceCode: '028064',
        tissCode: '0000092107',
        price: 4870.00,
      ),
      ProductVariant(
        name: 'TRUVISC 2.0%',
        simproCode: '0359467',
        brasindiceCode: '028065',
        tissCode: '0000092108',
        price: 5870.00,
      ),
    ],
  ),
];

// ── Price comparison table (Brasíndice/Simpro) ────────────────
final _priceTable = <PriceTableGroup>[
  PriceTableGroup(
    familyName: 'REVISCON 1.0% - 20MG / 2ML',
    rows: [
      PriceTableRow(
        productName: 'SINGLE JOINT 24MG / 2ML',
        tags: const ['NACIONAL'],
        updatedAt: DateTime(2025, 5, 7),
        price17: 6000.00,
        price18: 6000.00,
        price20: 6000.00,
      ),
      PriceTableRow(
        productName: 'HYMOVIS SYNVIS 2ML',
        tags: const ['IMPORTADO', 'EUA'],
        updatedAt: DateTime(2025, 5, 7),
        price17: 6500.00,
        price18: 6500.00,
        price20: 6500.00,
      ),
      PriceTableRow(
        productName: 'REVISCON 1.0% - 20MG / 2ML',
        tags: const ['NACIONAL', 'ALEMANHA'],
        updatedAt: DateTime(2025, 6, 5),
        price17: 1840.00,
        price18: 1840.00,
        price20: 1840.00,
        isOwn: true,
      ),
      PriceTableRow(
        productName: 'BIOVISC ORTHO 20MG / 2ML',
        tags: const ['NACIONAL'],
        updatedAt: DateTime(2025, 4, 3),
        price17: 1807.04,
        price18: 1802.06,
        price20: 1807.09,
      ),
      PriceTableRow(
        productName: 'POLIREUMIN',
        tags: const ['NACIONAL', 'ALEMANHA'],
        updatedAt: DateTime(2025, 6, 2),
        price17: 606.70,
        price18: 610.08,
        price20: 626.64,
      ),
    ],
  ),
  PriceTableGroup(
    familyName: 'REVISCON PLUS 1.6% - 32MG / 2ML',
    rows: [
      PriceTableRow(
        productName: 'KD INTRA-ARTICULAR GEL 2.2%',
        tags: const ['NACIONAL'],
        updatedAt: DateTime(2025, 3, 27),
        price17: 3906.00,
        price18: 3906.00,
        price20: 3906.00,
      ),
      PriceTableRow(
        productName: 'REVISCON PLUS 1.6% - 32MG / 2ML',
        tags: const ['NACIONAL', 'ALEMANHA'],
        updatedAt: DateTime(2025, 6, 5),
        price17: 3175.00,
        price18: 3175.00,
        price20: 3175.00,
        isOwn: true,
      ),
      PriceTableRow(
        productName: 'SYNGEL 2ML',
        tags: const ['IMPORTADO'],
        updatedAt: DateTime(2025, 4, 4),
        price17: 2492.41,
        price18: 2492.41,
        price20: 2492.41,
      ),
    ],
  ),
  PriceTableGroup(
    familyName: 'REVISCON MONO 2.0% - 48MG / 2.4ML',
    rows: [
      PriceTableRow(
        productName: 'HYALGAN PLUS 60MG / 3ML',
        tags: const ['NACIONAL'],
        updatedAt: DateTime(2025, 4, 3),
        price17: 6000.00,
        price18: 6000.00,
        price20: 6000.00,
      ),
      PriceTableRow(
        productName: 'REVISCON MONO 2.0% - 48MG / 2.4ML',
        tags: const ['NACIONAL', 'ALEMANHA'],
        updatedAt: DateTime(2025, 6, 5),
        price17: 5150.00,
        price18: 5150.00,
        price20: 5150.00,
        isOwn: true,
      ),
    ],
  ),
];
