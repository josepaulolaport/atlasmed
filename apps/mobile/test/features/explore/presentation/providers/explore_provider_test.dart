import 'package:atlasmed_mobile_app/features/explore/data/domain/facility_entry.dart';';
import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_recurrence.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:flutter_test/flutter_test.dart';

const _clinic = Clinic(
  id: 'facility-1',
  name: 'Clínica Central',
  city: '',
  neighborhood: '',
  distanceKm: null,
  commercialStatus: null,
  lastVisitDays: null,
  doctorCount: 0,
  isPriority: false,
  products: [],
);

void main() {
  test('preserves server order for recurrence sort keys', () {
    final state = ExploreState(
      sort: 'purchase-funnel-asc',
      clinics: [
        _clinic,
        Clinic(
          id: 'facility-2',
          name: 'Outra clínica',
          city: '',
          neighborhood: '',
          distanceKm: null,
          commercialStatus: null,
          lastVisitDays: null,
          doctorCount: 0,
          isPriority: false,
          products: const [],
          purchaseRecurrence: const PurchaseRecurrenceSnapshot(
            intervalDays: 30,
            sampleSize: 2,
            funnelStage: PurchaseFunnelStage.churn,
          ),
        ),
      ],
    );

    expect(state.filteredClinics.map((clinic) => clinic.id), [
      'facility-1',
      'facility-2',
    ]);
  });

  test('keeps string sort state while sorting names locally', () {
    final state = ExploreState(
      sort: 'name-asc',
      clinics: [
        _clinic,
        const Clinic(
          id: 'facility-2',
          name: 'Alfa',
          city: '',
          neighborhood: '',
          distanceKm: null,
          commercialStatus: null,
          lastVisitDays: null,
          doctorCount: 0,
          isPriority: false,
          products: [],
        ),
      ],
    );

    expect(state.sort, 'name-asc');
    expect(state.filteredClinics.first.name, 'Alfa');
  });
}
