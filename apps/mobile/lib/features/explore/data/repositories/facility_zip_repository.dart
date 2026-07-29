import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_payer_share_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/facility_representative_api_type.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional_roster.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/clinic_detail_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_nearby_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_orders_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_payer_shares_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_photos_repository.dart';
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

/// Complete domain aggregate consumed by the clinic detail screen.
class FacilityIntegrations {
  const FacilityIntegrations({
    this.photos,
    this.orders,
    this.payerShares,
    this.administrators,
    this.doctors,
    this.notes,
    this.nearby,
    this.administratorsLoadingMore = false,
    this.doctorsLoadingMore = false,
  });

  final PhotoGallerySummary? photos;
  final List<FacilityOrderSummary>? orders;
  final List<PayerShare>? payerShares;
  final FacilityRosterPage<AdministrativeProfessional>? administrators;
  final FacilityRosterPage<ProfessionalRoster>? doctors;
  final List<FacilityFieldNote>? notes;
  final List<NearbyEstablishment>? nearby;
  final bool administratorsLoadingMore;
  final bool doctorsLoadingMore;

  FacilityRosterPage<AdministrativeProfessional> get administratorRoster =>
      administrators ?? _emptyRoster();

  FacilityRosterPage<ProfessionalRoster> get doctorRoster =>
      doctors ?? _emptyRoster();

  FacilityIntegrations copyWith({
    PhotoGallerySummary? photos,
    List<FacilityOrderSummary>? orders,
    List<PayerShare>? payerShares,
    FacilityRosterPage<AdministrativeProfessional>? administrators,
    FacilityRosterPage<ProfessionalRoster>? doctors,
    List<FacilityFieldNote>? notes,
    List<NearbyEstablishment>? nearby,
    bool? administratorsLoadingMore,
    bool? doctorsLoadingMore,
  }) {
    return FacilityIntegrations(
      photos: photos ?? this.photos,
      orders: orders ?? this.orders,
      payerShares: payerShares ?? this.payerShares,
      administrators: administrators ?? this.administrators,
      doctors: doctors ?? this.doctors,
      notes: notes ?? this.notes,
      nearby: nearby ?? this.nearby,
      administratorsLoadingMore:
          administratorsLoadingMore ?? this.administratorsLoadingMore,
      doctorsLoadingMore: doctorsLoadingMore ?? this.doctorsLoadingMore,
    );
  }
}

/// Combines every read model needed by the clinic detail screen.
///
/// DTO mapping, pagination accumulation and slice-specific mutations stay
/// behind this interface. The screen only observes [FacilityIntegrations].
class FacilityZipRepository extends ZipRepository<FacilityIntegrations> {
  factory FacilityZipRepository(
    String facilityId, {
    required ClinicDetailRepository detailRepository,
    String? verticalId,
  }) {
    final photos = FacilityPhotosRepository(facilityId);
    final orders = FacilityOrdersRepository(
      facilityId: facilityId,
      page: 1,
      limit: 5,
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
      detailRepository: detailRepository,
      verticalId: verticalId,
    );

    return FacilityZipRepository._(
      facilityId: facilityId,
      photos: photos,
      orders: orders,
      payers: payers,
      administrators: administrators,
      doctors: doctors,
      notes: notes,
      nearby: nearby,
    );
  }

  FacilityZipRepository._({
    required this.facilityId,
    required FacilityPhotosRepository photos,
    required FacilityOrdersRepository orders,
    required FacilityPayerSharesRepository payers,
    required FacilityRepresentativesRepository administrators,
    required FacilityProfessionalsRepository doctors,
    required FacilityNotesRepository notes,
    required FacilityNearbyRepository nearby,
  }) : _payers = payers,
       _administrators = administrators,
       _doctors = doctors,
       _notes = notes,
       super(
         repositories: [
           photos,
           orders,
           payers,
           administrators,
           doctors,
           notes,
           nearby,
         ],
       );

  final String facilityId;
  final FacilityPayerSharesRepository _payers;
  final FacilityRepresentativesRepository _administrators;
  final FacilityProfessionalsRepository _doctors;
  final FacilityNotesRepository _notes;

  final List<AdministrativeProfessional> _additionalAdministrators = [];
  final List<ProfessionalRoster> _additionalDoctors = [];
  Pagination? _administratorPagination;
  Pagination? _doctorPagination;
  bool _administratorsLoadingMore = false;
  bool _doctorsLoadingMore = false;

  @override
  FacilityIntegrations zipper(List<dynamic> values) {
    final photosResponse = values[0] as FacilityPhotosResponse?;
    final ordersPage = values[1] as FacilityOrdersPage?;
    final payerResponse = values[2] as FacilityPayerSharesResponse?;
    final administratorPage = values[3] as PaginatedFacilityRepresentatives?;
    final doctorPage = values[4] as PaginatedFacilityProfessionals?;
    final notes = values[5] as List<FacilityFieldNote>?;
    final nearby = values[6] as List<NearbyEstablishment>?;

    return facilityIntegrationsFromResponses(
      photos: photosResponse,
      orders: ordersPage,
      payers: payerResponse,
      administrators: administratorPage,
      doctors: doctorPage,
      notes: notes,
      nearby: nearby,
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

  Future<List<PayerShare>> replacePayerShares(List<PayerShare> payers) async {
    final saved = await _payers.replaceShares(payers);
    await _payers.refresh();
    return saved;
  }

  Future<FacilityFieldNote> createNote(String text) => _notes.createNote(text);

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
  Future<FacilityIntegrations> refresh() async {
    _additionalAdministrators.clear();
    _additionalDoctors.clear();
    _administratorPagination = null;
    _doctorPagination = null;
    _administratorsLoadingMore = false;
    _doctorsLoadingMore = false;
    return super.refresh();
  }

  @override
  void dispose() {
    for (final repository in repositories) {
      repository.dispose();
    }
    super.dispose();
  }
}

FacilityIntegrations facilityIntegrationsFromResponses({
  FacilityPhotosResponse? photos,
  FacilityOrdersPage? orders,
  FacilityPayerSharesResponse? payers,
  PaginatedFacilityRepresentatives? administrators,
  PaginatedFacilityProfessionals? doctors,
  List<FacilityFieldNote>? notes,
  List<NearbyEstablishment>? nearby,
  Iterable<AdministrativeProfessional> additionalAdministrators = const [],
  Iterable<ProfessionalRoster> additionalDoctors = const [],
  Pagination? administratorPagination,
  Pagination? doctorPagination,
  bool administratorsLoadingMore = false,
  bool doctorsLoadingMore = false,
}) {
  return FacilityIntegrations(
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
