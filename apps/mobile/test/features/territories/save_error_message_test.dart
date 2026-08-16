import 'package:atlasmed_mobile_app/features/territories/editing/models/save_error_message.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  String describe(String message, {int statusCode = 422}) =>
      describeTerritorySaveError(statusCode: statusCode, message: message);

  test('the disconnected-polygon rejection says what to do about it', () {
    final result = describe(
      'Operation not allowed: This territory type must be a single connected '
      'polygon; merge or remove disconnected areas before saving',
    );

    expect(result, contains('única e contínua'));
    expect(result, isNot(contains('polygon')));
  });

  test('an invalid contour is named as a drawing problem', () {
    expect(
      describe('Operation not allowed: Invalid geometry'),
      contains('contorno desenhado é inválido'),
    );
    expect(
      describe('Operation not allowed: Polygon coordinates cannot be empty'),
      contains('contorno desenhado é inválido'),
    );
  });

  test('the admin-only zone rule is explained, not quoted', () {
    final result = describe(
      'Operation not allowed: Only admins can edit manager zone boundaries',
    );

    expect(result, contains('administrador'));
    expect(result, isNot(contains('admins')));
  });

  test('an inactive territory says so', () {
    expect(
      describe('Operation not allowed: Territory is not active'),
      contains('inativo'),
    );
  });

  test('falls back to Portuguese rather than echoing an unknown server '
      'sentence', () {
    expect(
      describe('Some unmapped backend explosion'),
      'Não foi possível salvar. Tente novamente.',
    );
  });

  test('permission and missing-territory statuses are distinguished', () {
    expect(describe('nope', statusCode: 403), contains('não tem permissão'));
    expect(describe('gone', statusCode: 404), contains('não existe mais'));
  });
}
