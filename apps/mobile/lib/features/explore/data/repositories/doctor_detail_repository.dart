import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment_mixin.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';

/// Repository for fetching a single professional's detail from the API.
class DoctorDetailRepository extends Repository<ProfessionalDTO>
    with SessionEnvironmentMixin<ProfessionalDTO> {
  DoctorDetailRepository({required int id})
    : super(
        endpoint: Uri.parse('${AppConfig.apiBaseUrl}/api/v1/persons/$id'),
        name: 'DoctorDetailRepository',
      );

  @override
  ProfessionalDTO fromJson(String json) => ProfessionalDTO.fromJson(json);
}
