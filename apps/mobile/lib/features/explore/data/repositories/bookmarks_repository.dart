import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

class BookmarkException implements Exception {
  const BookmarkException([this.message]);

  final String? message;

  @override
  String toString() => message ?? 'BookmarkException';
}

/// What a bookmark can be attached to.
///
/// Clinics and doctors are separate tables and separate endpoints on the API —
/// a bookmark carries a real foreign key rather than a polymorphic id — so the
/// only thing shared here is the shape of the call.
enum BookmarkKind {
  clinic('facilities'),
  doctor('healthcare-professionals');

  const BookmarkKind(this.pathSegment);

  final String pathSegment;
}

/// What the toggle needs from the network layer.
///
/// An interface rather than the concrete class so tests can stand in without
/// constructing [Repository], whose base starts a periodic refresh timer and a
/// hydration fiber the moment it is built — harmless in the app, but a widget
/// test fails on a pending timer.
abstract interface class BookmarkToggleApi {
  Future<void> setBookmarked({
    required BookmarkKind kind,
    required int id,
    required bool bookmarked,
  });
}

/// `PUT` / `DELETE /<kind>/:id/bookmark`.
///
/// Still a [Repository] despite having no cached GET of its own: the base is
/// what supplies the shared authenticated client and, through
/// [SessionEnvironmentMixin], the 401-refresh handling in `onErrorStatusCode`.
/// Reimplementing those to avoid the inheritance would be the worse trade.
///
/// Screens call this directly and flip their own state first, so a tap reads as
/// instant on the flaky connections reps actually work on.
class BookmarkToggleRepository extends Repository<void>
    with SessionEnvironmentMixin<void>
    implements BookmarkToggleApi {
  BookmarkToggleRepository({String? baseUrl, RepositoryHttpClient? client})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl,
      _client = client,
      super(
        endpoint: Uri.parse('${baseUrl ?? AppConfig.apiBaseUrl}/api/v1'),
        name: 'BookmarkToggleRepository',
      );

  final String _baseUrl;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  void fromJson(String json) {}

  @override
  Future<void> setBookmarked({
    required BookmarkKind kind,
    required int id,
    required bool bookmarked,
  }) async {
    final response = await client.call(
      request: RepositoryHttpRequest(
        url: Uri.parse('$_baseUrl/api/v1/${kind.pathSegment}/$id/bookmark'),
        method: bookmarked
            ? RepositoryHttpMethod.put
            : RepositoryHttpMethod.delete,
      ),
    );

    if (!successfulCondition(response.statusCode, response.body)) {
      final shouldThrow = await onErrorStatusCode(response.statusCode);
      if (shouldThrow) {
        throw BookmarkException(
          bookmarked
              ? 'Não foi possível salvar nos favoritos (${response.statusCode})'
              : 'Não foi possível remover dos favoritos (${response.statusCode})',
        );
      }
    }
  }
}

/// `GET /me/bookmarks/facilities` — the caller's saved clinics, newest first.
///
/// Returns [PaginatedFacilities], the same model the Explore list uses, because
/// the endpoint returns the same clinic DTO. That is what lets the Favoritos
/// tab render with the existing clinic card instead of a parallel one that
/// would drift.
class ClinicBookmarksRepository extends Repository<PaginatedFacilities>
    with SessionEnvironmentMixin<PaginatedFacilities> {
  ClinicBookmarksRepository({
    String? baseUrl,
    RepositoryHttpClient? client,
    this.page = 1,
    this.limit = 20,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${baseUrl ?? AppConfig.apiBaseUrl}/api/v1/me/bookmarks/facilities'
           '?page=$page&limit=$limit',
         ),
         name: 'ClinicBookmarksRepository',
       );

  final int page;
  final int limit;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  PaginatedFacilities fromJson(String json) =>
      PaginatedFacilities.fromJson(json);

  Future<PaginatedFacilities> load() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const BookmarkException('Falha ao carregar clínicas favoritas');
    }
    return result;
  }
}

/// `GET /me/bookmarks/healthcare-professionals` — saved doctors, newest first.
class DoctorBookmarksRepository extends Repository<PaginatedProfessionals>
    with SessionEnvironmentMixin<PaginatedProfessionals> {
  DoctorBookmarksRepository({
    String? baseUrl,
    RepositoryHttpClient? client,
    this.page = 1,
    this.limit = 20,
  }) : _client = client,
       super(
         endpoint: Uri.parse(
           '${baseUrl ?? AppConfig.apiBaseUrl}'
           '/api/v1/me/bookmarks/healthcare-professionals'
           '?page=$page&limit=$limit',
         ),
         name: 'DoctorBookmarksRepository',
       );

  final int page;
  final int limit;
  final RepositoryHttpClient? _client;

  @override
  RepositoryHttpClient get client => _client ?? super.client;

  @override
  PaginatedProfessionals fromJson(String json) =>
      PaginatedProfessionals.fromJson(json);

  Future<PaginatedProfessionals> load() async {
    final result = await currentValueOrResolve();
    if (result == null) {
      throw const BookmarkException('Falha ao carregar médicos favoritos');
    }
    return result;
  }
}
