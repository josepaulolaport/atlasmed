import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/mock_user_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late MockUserRepository repository;

  setUp(() => repository = MockUserRepository());

  group('getUserById', () {
    test('returns the matching user', () async {
      final user = await repository.getUserById('user-fernanda-duarte');
      expect(user, isNotNull);
      expect(user!.name, 'Fernanda Duarte');
      expect(user.role, UserRole.manager);
    });

    test('returns null for an unknown id', () async {
      final user = await repository.getUserById('user-does-not-exist');
      expect(user, isNull);
    });
  });

  group('searchUsers', () {
    test('filters by role', () async {
      final managers = await repository.searchUsers(role: UserRole.manager);
      expect(managers, isNotEmpty);
      expect(managers.every((u) => u.role == UserRole.manager), isTrue);
    });

    test('filters by verticalId', () async {
      final reps = await repository.searchUsers(
        role: UserRole.rep,
        verticalId: 'sector-cardiologia',
      );
      expect(reps, isNotEmpty);
      expect(reps.every((u) => u.verticalId == 'sector-cardiologia'), isTrue);
    });

    test('filters by a case-insensitive name query', () async {
      final results = await repository.searchUsers(
        role: UserRole.rep,
        query: 'camila',
      );
      expect(results.length, 1);
      expect(results.first.name, 'Camila Rocha');
    });

    test('an empty query returns every matching user', () async {
      final all = await repository.searchUsers(role: UserRole.rep);
      final filtered = await repository.searchUsers(
        role: UserRole.rep,
        query: '',
      );
      expect(filtered.length, all.length);
    });

    test('combines role, sector and query filters', () async {
      final results = await repository.searchUsers(
        role: UserRole.manager,
        verticalId: 'sector-oncologia',
        query: 'marcos',
      );
      expect(results.length, 1);
      expect(results.first.id, 'user-marcos-lima');
    });
  });
}
