import 'dart:convert';
import 'dart:io';

import 'package:atlasmed_mobile_app/features/explore/presentation/tax_identifier.dart';
import 'package:flutter_test/flutter_test.dart';

/// The app's half of the shared CPF fixture.
///
/// Same cases as `isValidCpfDigits` in the API and `is_valid_cpf` in Postgres.
/// Three implementations exist because each answers a question the others
/// cannot — the database filters rows for the Desempenho count and its list,
/// the server is the authority for any client, and this one runs while the rep
/// is still typing. What keeps them honest is answering the same cases.
///
/// Read from the repository rather than copied: a copy would drift the moment
/// somebody added a case on one side only, which is the whole failure this
/// guards against.
void main() {
  final file = File('../../packages/database/fixtures/cpf-checksum-cases.json');
  final cases =
      (jsonDecode(file.readAsStringSync()) as Map<String, dynamic>)['cases']
          as List<dynamic>;

  test('the fixture is where this test expects it', () {
    // A moved or renamed fixture must fail loudly here rather than leave this
    // suite silently asserting nothing.
    expect(file.existsSync(), isTrue);
    expect(cases, isNotEmpty);
  });

  test('the fixture still has cases on both sides of the verdict', () {
    // Drifted to all-invalid, it would pass against a validator that always
    // returned false.
    expect(cases.any((c) => (c as Map)['valid'] == true), isTrue);
    expect(cases.any((c) => (c as Map)['valid'] == false), isTrue);
  });

  for (final entry in cases) {
    final testCase = entry as Map<String, dynamic>;
    final raw = testCase['raw'] as String;
    final expected = testCase['valid'] as bool;
    final why = testCase['why'] as String;

    test('${expected ? 'accepts' : 'rejects'} ${jsonEncode(raw)} — $why', () {
      expect(isValidCpf(raw), expected);
    });
  }

  group('cpfIssueFor', () {
    test('reports a missing CPF only for CPF clinics', () {
      expect(
        cpfIssueFor(legalDocumentType: 'CPF', legalDocument: null),
        CpfIssue.missing,
      );
      expect(
        cpfIssueFor(legalDocumentType: 'CPF', legalDocument: '   '),
        CpfIssue.missing,
      );
      // A CNPJ clinic with no CNPJ is a real problem, but not this warning's.
      expect(
        cpfIssueFor(legalDocumentType: 'CNPJ', legalDocument: null),
        isNull,
      );
    });

    test('separates an invalid CPF from a missing one', () {
      expect(
        cpfIssueFor(legalDocumentType: 'CPF', legalDocument: '529.982.247-24'),
        CpfIssue.invalid,
      );
      expect(
        cpfIssueFor(legalDocumentType: 'CPF', legalDocument: '529.982.247-25'),
        isNull,
      );
    });

    test('says nothing about a CNPJ clinic whatever its document', () {
      // is_valid_cpf is false for any 14-digit number, so a check that forgot
      // the type would flag every CNPJ clinic in the app.
      expect(
        cpfIssueFor(
          legalDocumentType: 'CNPJ',
          legalDocument: '12.345.678/0001-95',
        ),
        isNull,
      );
    });
  });
}
