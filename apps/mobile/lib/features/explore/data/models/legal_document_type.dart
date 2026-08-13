/// Legal document a clinic is registered under.
///
/// CNPJ is a company, CPF a sole practitioner registered as an individual. The
/// API accepts exactly one of these, case-sensitive, so the filter is single
/// choice rather than multi-select.
abstract final class LegalDocumentTypeFilter {
  static const values = ['CNPJ', 'CPF'];

  static String label(String value) => switch (value) {
    'CNPJ' => 'Pessoa jurídica (CNPJ)',
    'CPF' => 'Pessoa física (CPF)',
    _ => value,
  };

  /// Shorter form for the chip row, where horizontal space is scarce.
  static String shortLabel(String value) => switch (value) {
    'CNPJ' => 'CNPJ',
    'CPF' => 'CPF',
    _ => value,
  };

  static bool isValid(String value) => values.contains(value);
}
