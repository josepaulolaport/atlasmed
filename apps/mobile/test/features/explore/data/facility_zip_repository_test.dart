import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_payer_share_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_representative_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_orders_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_photos_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_zip_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps every clinic detail response into one domain aggregate', () {
    final aggregate = facilityIntegrationsFromResponses(
      photos: const FacilityPhotosResponse(
        imageUrl: 'https://example.test/profile.jpg',
        photos: [],
      ),
      orders: FacilityOrdersPage(
        orders: [
          FacilityOrderSummary(
            id: 'order-1',
            displayId: 'PED-1',
            status: 'PENDING',
            orderedAt: DateTime.utc(2026),
            total: 120,
            itemCount: 2,
          ),
        ],
      ),
      payers: const FacilityPayerSharesResponse(
        items: [
          FacilityPayerShareApi(
            id: 'share-1',
            facilityId: 'clinic-1',
            healthcareProviderId: 'payer-1',
            sharePercent: 70,
            providerName: 'Unimed',
          ),
        ],
      ),
      administrators: PaginatedFacilityRepresentatives(
        items: const [
          FacilityRepresentativeApi(
            id: 'admin-1',
            facilityId: 'clinic-1',
            representativeName: 'Ana',
            contactType: 'PROFESSIONAL',
          ),
        ],
        pagination: const Pagination(
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        ),
      ),
      doctors: PaginatedFacilityProfessionals(
        items: const [
          FacilityProfessionalItemDTO(
            facilityProfessionalId: 'association-1',
            professional: ProfessionalDTO(
              id: 'doctor-1',
              firstName: 'João',
              lastName: 'Silva',
              facilityIds: ['clinic-1'],
            ),
            association: ProfessionalAssociationDTO(
              facilityProfessionalId: 'association-1',
              facilityId: 'clinic-1',
              professionalId: 'doctor-1',
            ),
          ),
        ],
        pagination: const Pagination(
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        ),
      ),
      notes: [
        FacilityFieldNote(
          id: 'note-1',
          text: 'Retornar amanhã',
          createdAt: DateTime.utc(2026),
        ),
      ],
      nearby: const [
        NearbyEstablishment(
          id: 'clinic-2',
          name: 'Clínica Vizinha',
          latitude: -23,
          longitude: -43,
          distanceKm: 2,
        ),
      ],
      administratorsLoadingMore: true,
      doctorsLoadingMore: true,
    );

    expect(aggregate.photos?.profileImageUrl, contains('profile.jpg'));
    expect(aggregate.orders?.single.id, 'order-1');
    expect(aggregate.payerShares?.single.name, 'Unimed');
    expect(aggregate.administratorRoster.items.single.name, 'Ana');
    expect(aggregate.doctorRoster.items.single.name, 'João Silva');
    expect(aggregate.notes?.single.text, 'Retornar amanhã');
    expect(aggregate.nearby?.single.id, 'clinic-2');
    expect(aggregate.administratorsLoadingMore, isTrue);
    expect(aggregate.doctorsLoadingMore, isTrue);
  });

  test('keeps unloaded slices distinct from loaded empty slices', () {
    const unloaded = FacilityIntegrations();
    final loadedEmpty = facilityIntegrationsFromResponses(
      orders: const FacilityOrdersPage(orders: []),
      payers: const FacilityPayerSharesResponse(items: []),
      notes: const [],
      nearby: const [],
    );

    expect(unloaded.orders, isNull);
    expect(unloaded.notes, isNull);
    expect(loadedEmpty.orders, isEmpty);
    expect(loadedEmpty.payerShares, isEmpty);
    expect(loadedEmpty.notes, isEmpty);
    expect(loadedEmpty.nearby, isEmpty);
  });
}
