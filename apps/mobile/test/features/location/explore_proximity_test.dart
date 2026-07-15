import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/doctor_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/explore_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/clinic.dart';
import 'package:atlasmed_mobile_app/features/explore/data/models/doctor.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'retains the user location for a future proximity list request',
    () async {
      final notifier = ExploreNotifier(
        _EmptyExploreRepository(),
        _LocationServiceReturning(
          const LocationAvailable(
            DeviceLocation(latitude: -23.55052, longitude: -46.633308),
          ),
        ),
      );

      await notifier.enableProximity();

      expect(
        notifier.state.proximityOrigin,
        const DeviceLocation(latitude: -23.55052, longitude: -46.633308),
      );
      expect(notifier.state.proximityFailure, isNull);
    },
  );

  test('exposes a recoverable failure and leaves proximity inactive', () async {
    final notifier = ExploreNotifier(
      _EmptyExploreRepository(),
      _LocationServiceReturning(
        const LocationUnavailable(LocationFailure.denied),
      ),
    );

    await notifier.enableProximity();

    expect(notifier.state.proximityOrigin, isNull);
    expect(notifier.state.proximityFailure, LocationFailure.denied);
  });
}

class _LocationServiceReturning extends LocationService {
  final LocationResult result;

  _LocationServiceReturning(this.result) : super(_UnusedLocationPlatform());

  @override
  Future<LocationResult> requestCurrentLocation() async => result;
}

class _UnusedLocationPlatform implements LocationPlatform {
  @override
  Future<LocationPermissionStatus> checkPermission() =>
      throw UnimplementedError();

  @override
  Future<DeviceLocation> getCurrentPosition() => throw UnimplementedError();

  @override
  Future<bool> isLocationServiceEnabled() => throw UnimplementedError();

  @override
  Future<LocationPermissionStatus> requestPermission() =>
      throw UnimplementedError();
}

class _EmptyExploreRepository implements ExploreRepository {
  @override
  Future<List<Clinic>> getClinics() async => const [];

  @override
  Future<List<Doctor>> getDoctors() async => const [];

  @override
  Future<ClinicDetail> getClinicDetail(String id) => throw UnimplementedError();

  @override
  Future<DoctorDetail> getDoctorDetail(String id) => throw UnimplementedError();
}
