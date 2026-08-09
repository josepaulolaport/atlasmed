/// Mock products for the revamped Produtos experience.
/// Intentionally decoupled from the catalog API so we can redesign the UX
/// without being constrained by the current backend shape.
///
/// List shows [MockProductFamily]; detail picks a [MockProduct] concentration
/// within that family.
class MockProductFamily {
  const MockProductFamily({
    required this.id,
    required this.name,
    required this.manufacturer,
    required this.countryOfOrigin,
    required this.sector,
    required this.tagline,
  });

  final int id;
  final String name;
  final String manufacturer;
  final String countryOfOrigin;
  final String sector;
  final String tagline;
}

class MockProduct {
  const MockProduct({
    required this.id,
    required this.familyId,
    required this.name,
    required this.presentation,
    required this.manufacturer,
    required this.countryOfOrigin,
    required this.price,
    required this.sector,
    required this.tagline,
    required this.overview,
    required this.simproCode,
    required this.brasindiceCode,
    required this.tissCode,
    this.isInHouse = false,
    this.competitorMatchCount = 0,
  });

  final int id;

  /// Groups concentrations of the same brand (e.g. Reviscon 1.0% / Plus / Mono).
  final int familyId;
  final String name;
  final String presentation;
  final String manufacturer;
  final String countryOfOrigin;
  final double price;
  final String sector;
  final String tagline;
  final String overview;
  final String simproCode;
  final String brasindiceCode;
  final String tissCode;
  final bool isInHouse;
  final int competitorMatchCount;
}

const mockProductSectors = <String>['Viscossuplementação'];

const mockProductFamilies = <MockProductFamily>[
  MockProductFamily(
    id: 1001,
    name: 'Reviscon',
    manufacturer: 'VSY',
    countryOfOrigin: 'DE',
    sector: 'Viscossuplementação',
    tagline: 'Ácido hialurônico de alta pureza para OA de joelho',
  ),
];

const mockProducts = <MockProduct>[
  MockProduct(
    id: 1002,
    familyId: 1001,
    name: 'Reviscon 1.0%',
    presentation: '20mg / 2mL',
    manufacturer: 'VSY',
    countryOfOrigin: 'DE',
    price: 1840,
    sector: 'Viscossuplementação',
    tagline: 'Ácido hialurônico de alta pureza para OA de joelho',
    overview:
        'Viscossuplementação de 1ª linha para osteoartrite de joelho. '
        'Apresentação pré-preenchida de 2 mL com concentração de 10 mg/mL '
        'equivalente em uso clínico habitual.',
    simproCode: '00308555',
    brasindiceCode: '024847',
    tissCode: '0000094527',
    isInHouse: true,
    competitorMatchCount: 2,
  ),
  MockProduct(
    id: 1003,
    familyId: 1001,
    name: 'Reviscon Plus 1.6%',
    presentation: '32mg / 2mL',
    manufacturer: 'VSY',
    countryOfOrigin: 'DE',
    price: 3175,
    sector: 'Viscossuplementação',
    tagline: 'Ácido hialurônico de alta pureza para OA de joelho',
    overview:
        'Concentração intermediária da linha Reviscon, indicada quando se '
        'busca maior densidade de HA com o mesmo volume de 2 mL por seringa.',
    simproCode: '00308556',
    brasindiceCode: '024848',
    tissCode: '0000094529',
    isInHouse: true,
    competitorMatchCount: 3,
  ),
  MockProduct(
    id: 1004,
    familyId: 1001,
    name: 'Reviscon Mono 2.0%',
    presentation: '40mg / 2mL',
    manufacturer: 'VSY',
    countryOfOrigin: 'DE',
    price: 5150,
    sector: 'Viscossuplementação',
    tagline: 'Ácido hialurônico de alta pureza para OA de joelho',
    overview:
        'Maior concentração da família Reviscon. Pensada para protocolos '
        'onde a densidade do gel e a duração do efeito são prioritárias.',
    simproCode: '00308557',
    brasindiceCode: '024849',
    tissCode: '0000094530',
    isInHouse: true,
    competitorMatchCount: 4,
  ),
];

MockProductFamily? mockFamilyById(int id) {
  for (final family in mockProductFamilies) {
    if (family.id == id) return family;
  }
  return null;
}

MockProduct? mockProductById(int id) {
  for (final product in mockProducts) {
    if (product.id == id) return product;
  }
  return null;
}

List<MockProduct> mockProductsInFamily(int familyId) {
  return [
    for (final product in mockProducts)
      if (product.familyId == familyId) product,
  ];
}

/// Default concentration when opening a family from the list.
MockProduct? mockDefaultProductForFamily(int familyId) {
  final products = mockProductsInFamily(familyId);
  return products.isEmpty ? null : products.first;
}
