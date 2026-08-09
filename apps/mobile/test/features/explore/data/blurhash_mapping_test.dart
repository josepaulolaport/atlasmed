import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/facility_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_photos_repository.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps nullable blurhash fields from image-bearing API responses', () {
    final facility = FacilityDTO.fromMap({
      'id': 1,
      'name': 'Clínica Central',
      'professionalCount': 0,
      'imageUrl': '/facility.png',
      'imageBlurhash': 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
    });
    final professional = ProfessionalDTO.fromMap({
      'id': 1,
      'firstName': 'Ana',
      'lastName': 'Silva',
      'facilityIds': const [],
      'imageUrl': '/professional.png',
      'imageBlurhash': 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    });
    final user = User.fromJson(
      _userJson(avatarBlurhash: 'L9AS#?t7I=%2^+Rj00M{Rj?bxuM{'),
    );
    final manager = ManagerOption.fromJson({
      'id': 1,
      'name': 'Maria Souza',
      'avatarUrl': '/manager.png',
      'avatarBlurhash': 'L6Pj0^tl0f%g~qIURjIU00IU%Mxu',
    });
    final photos = FacilityPhotosResponse.fromJson('''
      {"imageUrl":"/facility.png","imageBlurhash":"L5H2EC=PM+yV0g-mq.wG9c010J}I","data":[
        {"id":1,"url":"/photo-1.png","blurhash":"LKO2?U%2Tw=w]~RBVZRi};RPxuwH"}
      ]}
    ''');

    expect(facility.imageBlurhash, 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH');
    expect(professional.imageBlurhash, 'LEHV6nWB2yk8pyo0adR*.7kCMdnj');
    expect(user.avatarBlurhash, 'L9AS#?t7I=%2^+Rj00M{Rj?bxuM{');
    expect(manager.avatarBlurhash, 'L6Pj0^tl0f%g~qIURjIU00IU%Mxu');
    expect(photos.photos.single.blurhash, 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH');
    expect(
      photos.toSummary().profileImageBlurhash,
      'L5H2EC=PM+yV0g-mq.wG9c010J}I',
    );
  });

  test('accepts API responses that do not yet contain blurhash fields', () {
    final facility = FacilityDTO.fromMap({
      'id': 1,
      'name': 'Clínica Central',
      'professionalCount': 0,
    });
    final user = User.fromJson(_userJson());
    final photos = FacilityPhotosResponse.fromJson('{"data":[]}');

    expect(facility.imageBlurhash, isNull);
    expect(user.avatarBlurhash, isNull);
    expect(photos.photos, isEmpty);
  });

  test('keeps the first photo blurhash fallback for legacy responses', () {
    final photos = FacilityPhotosResponse.fromJson('''
      {"imageUrl":"/photo-1.png","data":[
        {"id":1,"url":"/photo-1.png","blurhash":"LKO2?U%2Tw=w]~RBVZRi};RPxuwH"}
      ]}
    ''');

    expect(
      photos.toSummary().profileImageBlurhash,
      'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
    );
  });
}

Map<String, dynamic> _userJson({String? avatarBlurhash}) => {
  'id': 1,
  'email': 'ana@example.com',
  'username': 'ana',
  'avatarUrl': '/avatar.png',
  // ignore: use_null_aware_elements — value-nullable map entry, not key-nullable.
  if (avatarBlurhash != null) 'avatarBlurhash': avatarBlurhash,
  'status': 'ACTIVE',
  'emailVerified': true,
  'phoneVerified': false,
  'twoFactorEnabled': false,
  'role': {'id': 1, 'name': 'REP', 'permissions': const []},
  'createdAt': '2026-01-01T00:00:00.000Z',
  'updatedAt': '2026-01-01T00:00:00.000Z',
};
