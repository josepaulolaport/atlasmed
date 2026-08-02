import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_payer_share_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_representative_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/facility.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/facility_potential.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_detail_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_orders_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_payer_shares_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_photos_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_potential_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_professionals_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';
import 'package:atlasmed_mobile_app/repository/repositories/zip_repository.dart';

const _rosterPageSize = 20;

FacilityRosterPage<T> _emptyRoster<T>() {
  return const FacilityRosterPage(
    items: [],
    pagination: Pagination(
      page: 1,
      limit: _rosterPageSize,
      total: 0,
      totalPages: 0,
    ),
  );
}

/// Complete domain read model consumed by the clinic detail screen.
class FacilityDetailData {
  const FacilityDetailData({
    this.facility,
    this.photos,
    this.orders,
    this.payerShares,
    this.administrators,
    this.doctors,
    this.notes,
    this.nearby,
    this.potentials,
    this.administratorsLoadingMore = false,
    this.doctorsLoadingMore = false,
  });

  final Facility? facility;
  final PhotoGallerySummary? photos;
  final List<FacilityOrderSummary>? orders;
  final List<PayerShare>? payerShares;
  final FacilityRosterPage<AdministrativeProfessional>? administrators;
  final FacilityRosterPage<ProfessionalRoster>? doctors;
  final List<FacilityFieldNote>? notes;
  final List<NearbyEstablishment>? nearby;
  final FacilityPotentialsPage? potentials;
  final bool administratorsLoadingMore;
  final bool doctorsLoadingMore;

  FacilityRosterPage<AdministrativeProfessional> get administratorRoster =>
      administrators ?? _emptyRoster();

  FacilityRosterPage<ProfessionalRoster> get doctorRoster =>
      doctors ?? _emptyRoster();

  FacilityDetailData copyWith({
    Facility? facility,
    PhotoGallerySummary? photos,
    List<FacilityOrderSummary>? orders,
    List<PayerShare>? payerShares,
    FacilityRosterPage<AdministrativeProfessional>? administrators,
    FacilityRosterPage<ProfessionalRoster>? doctors,
    List<FacilityFieldNote>? notes,
    List<NearbyEstablishment>? nearby,
    FacilityPotentialsPage? potentials,
    bool? administratorsLoadingMore,
    bool? doctorsLoadingMore,
  }) {
    return FacilityDetailData(
      facility: facility ?? this.facility,
      photos: photos ?? this.photos,
      orders: orders ?? this.orders,
      payerShares: payerShares ?? this.payerShares,
      administrators: administrators ?? this.administrators,
      doctors: doctors ?? this.doctors,
      notes: notes ?? this.notes,
      nearby: nearby ?? this.nearby,
      potentials: potentials ?? this.potentials,
      administratorsLoadingMore:
          administratorsLoadingMore ?? this.administratorsLoadingMore,
      doctorsLoadingMore: doctorsLoadingMore ?? this.doctorsLoadingMore,
    );
  }
}

/// Combines every read model needed by the clinic detail screen.
///
/// DTO mapping, pagination accumulation and slice-specific mutations stay
/// behind this interface. The screen only observes [FacilityDetailData].
class FacilityZipRepository extends ZipRepository<FacilityDetailData> {
  factory FacilityZipRepository(String facilityId, {String? verticalId}) {
    final detail = ClinicDetailRepository(
      id: facilityId,
      verticalId: verticalId,
    );
    final photos = FacilityPhotosRepository(facilityId);
    final orders = FacilityOrdersRepository(
      facilityId: facilityId,
      page: 1,
      limit: 5,
      verticalId: verticalId,
    );
    final payers = FacilityPayerSharesRepository(facilityId);
    final administrators = FacilityRepresentativesRepository(
      facilityId,
      page: 1,
      limit: _rosterPageSize,
    );
    final doctors = FacilityProfessionalsRepository(
      facilityId,
      page: 1,
      limit: _rosterPageSize,
      view: 'all',
    );
    final notes = FacilityNotesRepository(facilityId);
    final nearby = FacilityNearbyRepository(
      facilityId: facilityId,
      detailRepository: detail,
      verticalId: verticalId,
    );
    final potentials = verticalId == null || verticalId.isEmpty
        ? null
        : FacilityPotentialRepository(
            facilityId: facilityId,
            verticalId: verticalId,
          );

    return FacilityZipRepository._(
      facilityId: facilityId,
      detail: detail,
      photos: photos,
      orders: orders,
      payers: payers,
      administrators: administrators,
      doctors: doctors,
      notes: notes,
      nearby: nearby,
      potentials: potentials,
    );
  }

  FacilityZipRepository._({
    required this.facilityId,
    required ClinicDetailRepository detail,
    required FacilityPhotosRepository photos,
    required FacilityOrdersRepository orders,
    required FacilityPayerSharesRepository payers,
    required FacilityRepresentativesRepository administrators,
    required FacilityProfessionalsRepository doctors,
    required FacilityNotesRepository notes,
    required FacilityNearbyRepository nearby,
    required FacilityPotentialRepository? potentials,
  }) : _detail = detail,
       _photos = photos,
       _payers = payers,
       _administrators = administrators,
       _doctors = doctors,
       _notes = notes,
       _potentials = potentials,
       super(
         repositories: [
           detail,
           photos,
           orders,
           payers,
           administrators,
           doctors,
           notes,
           nearby,
           ?potentials,
         ],
       );

  final String facilityId;
  final ClinicDetailRepository _detail;
  final FacilityPhotosRepository _photos;
  final FacilityPayerSharesRepository _payers;
  final FacilityRepresentativesRepository _administrators;
  final FacilityProfessionalsRepository _doctors;
  final FacilityNotesRepository _notes;
  final FacilityPotentialRepository? _potentials;

  final List<AdministrativeProfessional> _additionalAdministrators = [];
  final List<ProfessionalRoster> _additionalDoctors = [];
  Pagination? _administratorPagination;
  Pagination? _doctorPagination;
  bool _administratorsLoadingMore = false;
  bool _doctorsLoadingMore = false;

  @override
  FacilityDetailData zipper(List<dynamic> values) {
    final facility = values[0] as Facility?;
    final photosResponse = values[1] as FacilityPhotosResponse?;
    final ordersPage = values[2] as FacilityOrdersPage?;
    final payerResponse = values[3] as FacilityPayerSharesResponse?;
    final administratorPage = values[4] as PaginatedFacilityRepresentatives?;
    final doctorPage = values[5] as PaginatedFacilityProfessionals?;
    final notes = values[6] as List<FacilityFieldNote>?;
    final nearby = values[7] as List<NearbyEstablishment>?;
    final potentials = values.length > 8
        ? values[8] as FacilityPotentialsPage?
        : null;

    return facilityDetailDataFromResponses(
      facility: facility,
      photos: photosResponse,
      orders: ordersPage,
      payers: payerResponse,
      administrators: administratorPage,
      doctors: doctorPage,
      notes: notes,
      nearby: nearby,
      potentials: potentials,
      additionalAdministrators: _additionalAdministrators,
      additionalDoctors: _additionalDoctors,
      administratorPagination: _administratorPagination,
      doctorPagination: _doctorPagination,
      administratorsLoadingMore: _administratorsLoadingMore,
      doctorsLoadingMore: _doctorsLoadingMore,
    );
  }

  Future<void> loadMoreAdministrators() async {
    final current = currentValue?.administratorRoster;
    if (_administratorsLoadingMore ||
        current == null ||
        current.pagination.page >= current.pagination.totalPages) {
      return;
    }

    _administratorsLoadingMore = true;
    await _emitCurrent();
    final repository = FacilityRepresentativesRepository(
      facilityId,
      page: current.pagination.page + 1,
      limit: _rosterPageSize,
    );
    try {
      final page = await repository.loadPage();
      _additionalAdministrators.addAll(page.items);
      _administratorPagination = page.pagination;
    } finally {
      repository.dispose();
      _administratorsLoadingMore = false;
      await _emitCurrent();
    }
  }

  Future<void> loadMoreDoctors() async {
    final current = currentValue?.doctorRoster;
    if (_doctorsLoadingMore ||
        current == null ||
        current.pagination.page >= current.pagination.totalPages) {
      return;
    }

    _doctorsLoadingMore = true;
    await _emitCurrent();
    final repository = FacilityProfessionalsRepository(
      facilityId,
      page: current.pagination.page + 1,
      limit: _rosterPageSize,
      view: 'all',
    );
    try {
      final page = await repository.loadPage();
      _additionalDoctors.addAll(page.items);
      _doctorPagination = page.pagination;
    } finally {
      repository.dispose();
      _doctorsLoadingMore = false;
      await _emitCurrent();
    }
  }

  Future<void> refreshAdministrators() async {
    _additionalAdministrators.clear();
    _administratorPagination = null;
    await _administrators.refresh();
  }

  Future<void> refreshDoctors() async {
    _additionalDoctors.clear();
    _doctorPagination = null;
    await _doctors.refresh();
  }

  Future<FacilityPhotosResponse?> refreshPhotos() => _photos.refresh();

  Future<List<PayerShare>> replacePayerShares(List<PayerShare> payers) async {
    final saved = await _payers.replaceShares(payers);
    await _payers.refresh();
    return saved;
  }

  Future<List<PayerCatalogEntry>> loadPayerCatalog() async {
    if (facilityId.startsWith('near-') || facilityId.endsWith(':empty')) {
      return mockPayerCatalog;
    }

    final repository = HealthcareProvidersRepository(
      limit: 100,
      isActive: true,
    );
    try {
      final providers = await repository.loadProviders();
      return providers
          .where((provider) => provider.isActive)
          .map((provider) => provider.toCatalogEntry())
          .toList(growable: false);
    } finally {
      repository.dispose();
    }
  }

  Future<FacilityFieldNote> createNote(String text) => _notes.createNote(text);

  Future<FacilityPotentialsPage> replacePotentialValues(
    List<({String definitionId, double? quantity})> values,
  ) async {
    final repository = _potentials;
    if (repository == null) throw const FacilityPotentialException();
    final saved = await repository.patchValues(values);
    await repository.refresh();
    return saved;
  }

  Future<void> _emitCurrent() async {
    final current = currentValue;
    if (current == null) return;
    await emit(
      data: current.copyWith(
        administrators: current.administrators == null
            ? null
            : FacilityRosterPage(
                items: _mergeById(
                  current.administrators!.items,
                  _additionalAdministrators,
                  (item) => item.id,
                ),
                pagination:
                    _administratorPagination ??
                    current.administrators!.pagination,
              ),
        doctors: current.doctors == null
            ? null
            : FacilityRosterPage(
                items: _mergeById(
                  current.doctors!.items,
                  _additionalDoctors,
                  (item) => item.id,
                ),
                pagination: _doctorPagination ?? current.doctors!.pagination,
              ),
        administratorsLoadingMore: _administratorsLoadingMore,
        doctorsLoadingMore: _doctorsLoadingMore,
      ),
    );
  }

  @override
  Future<FacilityDetailData> refresh() async {
    _additionalAdministrators.clear();
    _additionalDoctors.clear();
    _administratorPagination = null;
    _doctorPagination = null;
    _administratorsLoadingMore = false;
    _doctorsLoadingMore = false;

    await _detail.refresh();
    await Future.wait(
      repositories
          .where((repository) => !identical(repository, _detail))
          .map((repository) => repository.refresh()),
    );

    return zipper(
      repositories.map((repository) => repository.currentValue).toList(),
    );
  }

  @override
  void dispose() {
    for (final repository in repositories) {
      repository.dispose();
    }
    super.dispose();
  }
}

FacilityDetailData facilityDetailDataFromResponses({
  Facility? facility,
  FacilityPhotosResponse? photos,
  FacilityOrdersPage? orders,
  FacilityPayerSharesResponse? payers,
  PaginatedFacilityRepresentatives? administrators,
  PaginatedFacilityProfessionals? doctors,
  List<FacilityFieldNote>? notes,
  List<NearbyEstablishment>? nearby,
  FacilityPotentialsPage? potentials,
  Iterable<AdministrativeProfessional> additionalAdministrators = const [],
  Iterable<ProfessionalRoster> additionalDoctors = const [],
  Pagination? administratorPagination,
  Pagination? doctorPagination,
  bool administratorsLoadingMore = false,
  bool doctorsLoadingMore = false,
}) {
  return FacilityDetailData(
    facility: facility,
    photos: photos?.toSummary(),
    orders: orders?.orders,
    payerShares: payers?.toDomain(),
    administrators: administrators == null
        ? null
        : FacilityRosterPage(
            items: _mergeById(
              administrators.items.map((item) => item.toDomain()),
              additionalAdministrators,
              (item) => item.id,
            ),
            pagination: administratorPagination ?? administrators.pagination,
          ),
    doctors: doctors == null
        ? null
        : FacilityRosterPage(
            items: _mergeById(
              doctors.items.map(ProfessionalRoster.fromRosterItem),
              additionalDoctors,
              (item) => item.id,
            ),
            pagination: doctorPagination ?? doctors.pagination,
          ),
    notes: notes,
    nearby: nearby,
    potentials: potentials,
    administratorsLoadingMore: administratorsLoadingMore,
    doctorsLoadingMore: doctorsLoadingMore,
  );
}

List<T> _mergeById<T>(
  Iterable<T> first,
  Iterable<T> second,
  String Function(T item) idOf,
) {
  final items = <String, T>{};
  for (final item in [...first, ...second]) {
    items[idOf(item)] = item;
  }
  return items.values.toList(growable: false);
}
