import 'clinic_detail.dart';
import 'doctor_detail.dart';
import 'models.dart';

/// Abstract repository for explore (clinic/doctor list + detail) data.
///
/// Implementations can be swapped: MockExploreRepository for dev,
/// ApiExploreRepository when backend is ready (Open/Closed principle).
abstract class ExploreRepository {
  Future<List<Clinic>> getClinics();
  Future<List<Doctor>> getDoctors();
  Future<ClinicDetail> getClinicDetail(String id);
  Future<DoctorDetail> getDoctorDetail(String id);
}
