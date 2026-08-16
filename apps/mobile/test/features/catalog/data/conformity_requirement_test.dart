import 'package:atlasmed_mobile_app/features/catalog/data/models/conformity_requirement.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Map<String, dynamic> row([Map<String, dynamic> overrides = const {}]) => {
    'id': 3,
    'slug': 'licenca_sanitaria',
    'name': 'Licença Sanitária',
    'isActive': true,
    'description': null,
    'verticalId': null,
    'appliesToLegalDocumentType': null,
    'allowedMimeTypes': ['application/pdf'],
    'maxFiles': 4,
    'maxFileSizeBytes': 10485760,
    'maxCombinedSizeBytes': 41943040,
    'requiresFrontAndBack': false,
    'requiresValidityDate': true,
    ...overrides,
  };

  test('parses the admin payload, limits and flags included', () {
    // The picker DTO omits the limits and the two flags — right for a
    // checklist, useless for the screen that sets them.
    final requirement = ConformityRequirement.fromJson(row());

    expect(requirement.slug, 'licenca_sanitaria');
    expect(requirement.allowedMimeTypes, ['application/pdf']);
    expect(requirement.maxFiles, 4);
    expect(requirement.maxFileSizeBytes, 10485760);
    expect(requirement.requiresValidityDate, isTrue);
    expect(requirement.requiresFrontAndBack, isFalse);
  });

  test('null scope columns mean "everyone", not "nobody"', () {
    // The widest possible reach, and the one an admin most needs stated: a
    // requirement with no scope is exigible from every clinic.
    final requirement = ConformityRequirement.fromJson(row());

    expect(requirement.verticalId, isNull);
    expect(requirement.appliesToLegalDocumentType, isNull);
    expect(requirement.scopeLabel, 'Todas as linhas · CNPJ e CPF');
  });

  test('a narrowed scope says so', () {
    final requirement = ConformityRequirement.fromJson(
      row({'verticalId': 2, 'appliesToLegalDocumentType': 'CNPJ'}),
    );

    expect(requirement.verticalId, 2);
    expect(
      requirement.appliesToLegalDocumentType,
      RequirementLegalDocumentType.cnpj,
    );
    expect(requirement.scopeLabel, 'Uma linha · Só CNPJ');
  });

  test('an unknown document type reads as unrestricted, not as a crash', () {
    // A new enum value shipped server-side must not take down the admin list —
    // and "unrestricted" is the honest reading of "I do not know this filter".
    expect(
      ConformityRequirement.fromJson(
        row({'appliesToLegalDocumentType': 'SOMETHING_NEW'}),
      ).appliesToLegalDocumentType,
      isNull,
    );
  });

  test('carries deletability from the admin list, and null elsewhere', () {
    // Found on the simulator: the form offered a delete and promised "nothing
    // references it" for a requirement a clinic had already answered, because
    // it never asked. Null here means *unknown*, and the button stays disabled.
    final fromList = ConformityRequirement.fromJson(
      row({'deletable': false, 'blockingReferences': {'conformityRecords': 1}}),
    );
    expect(fromList.deletability?.deletable, isFalse);
    expect(fromList.deletability?.blockedByLabel, '1 resposta de clínica');

    // A create/update response says nothing about references.
    expect(ConformityRequirement.fromJson(row()).deletability, isNull);
  });

  test('falls back to the column defaults when the API omits limits', () {
    final requirement = ConformityRequirement.fromJson({
      'id': 9,
      'slug': 'carta_cnpj',
      'name': 'Cartão CNPJ',
      'isActive': true,
    });

    expect(requirement.maxFiles, 10);
    expect(requirement.maxFileSizeBytes, 52428800);
    expect(requirement.maxCombinedSizeBytes, 209715200);
    expect(requirement.allowedMimeTypes, [
      'image/jpeg',
      'image/png',
      'application/pdf',
    ]);
  });
}
