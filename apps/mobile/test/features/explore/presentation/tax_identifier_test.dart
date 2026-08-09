import 'package:flutter_test/flutter_test.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/tax_identifier.dart';

void main() {
  group('displayTaxIdentifier', () {
    test('formats a CNPJ made of 14 digits', () {
      expect(
        displayTaxIdentifier(
          legalDocumentType: 'CNPJ',
          legalDocument: '12345678000195',
        ),
        const TaxIdentifier(label: 'CNPJ', value: '12.345.678/0001-95'),
      );
    });

    test('formats CPF when the facility is a natural person', () {
      expect(
        displayTaxIdentifier(
          legalDocumentType: 'CPF',
          legalDocument: '12345678909',
        ),
        const TaxIdentifier(label: 'CPF', value: '123.456.789-09'),
      );
    });

    test('infers CPF from 11 digits when type is omitted', () {
      expect(
        displayTaxIdentifier(legalDocument: '123.456.789-09'),
        const TaxIdentifier(label: 'CPF', value: '123.456.789-09'),
      );
    });

    test('uses the missing-value fallback for absent identifiers', () {
      expect(
        displayTaxIdentifier(legalDocumentType: 'CNPJ', legalDocument: ''),
        const TaxIdentifier(label: 'CNPJ', value: '—'),
      );
    });

    test('keeps malformed values without inventing digits', () {
      expect(
        displayTaxIdentifier(
          legalDocumentType: 'CNPJ',
          legalDocument: '12.345',
        ),
        const TaxIdentifier(label: 'CNPJ', value: '12.345'),
      );
    });
  });
}
