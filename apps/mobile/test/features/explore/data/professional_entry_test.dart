import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_entry.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps list enrichment fields into ProfessionalEntry', () {
    final dto = ProfessionalDTO.fromMap({
      'id': 'professional-1',
      'firstName': 'Ana',
      'lastName': 'Silva',
      'facilityIds': ['facility-1'],
      'displayFacility': {'id': 'facility-1', 'name': 'Clínica Central'},
      'relationshipLevel': 10,
      'isPriority': true,
      'crmNumber': '12345',
      'crmState': 'SP',
    });

    final entry = ProfessionalEntry.fromDTO(dto);

    expect(dto.relationshipLevel, 10);
    expect(entry.displayFacilityName, 'Clínica Central');
    expect(entry.relationshipLevel, 10);
    expect(entry.isPriority, isTrue);
    expect(entry.crm, 'CRM-SP 12345');
  });
}
