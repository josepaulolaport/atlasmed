import 'models.dart';

/// Abstract repository for explore (clinic/doctor list) data.
///
/// Implementations can be swapped: MockExploreRepository for dev,
/// ApiExploreRepository when backend is ready (Open/Closed principle).
abstract class ExploreRepository {
  Future<List<Clinic>> getClinics();
  Future<List<Doctor>> getDoctors();
}
