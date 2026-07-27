import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api_types/doctor_api_type.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Repository for fetching a single professional's detail from the API.
class DoctorDetailRepository extends Repository<ApiDoctor>
    with SessionEnvironmentMixin<ApiDoctor> {
  DoctorDetailRepository({required String id})
    : super(
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/professionals/$id'),
        resolveOnCreate: false,
        name: 'DoctorDetailRepository',
      );

  @override
  ApiDoctor fromJson(String json) => ApiDoctor.fromJson(json);
}
