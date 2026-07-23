import 'dart:convert';

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/invite_sector_assignment.dart';

import 'package:atlasmed_mobile_app/features/users/data/models/user_invitation.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/invitations_repository.dart';
import 'package:atlasmed_mobile_app/features/users/data/repositories/users_api_exception.dart';
import 'package:atlasmed_mobile_app/repository/external/platform_http_client.dart';
import 'package:atlasmed_mobile_app/repository/infra/repository_http_client.dart';

/// Real `/api/v1/access` implementation of [InvitationsRepository].
class HttpInvitationsRepository implements InvitationsRepository {
  HttpInvitationsRepository({String? baseUrl})
    : _baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final String _baseUrl;
  final RepositoryHttpClient _client = createPlatformHttpClient(
    tokenBuilder: SessionEnvironment.instance.tokenBuilder,
  );

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$_baseUrl/api/v1/access$path').replace(queryParameters: query);

  Future<RepositoryHttpResponse> _get(Uri url) =>
      _client.call(request: RepositoryHttpRequest(url: url));

  Future<RepositoryHttpResponse> _send(
    Uri url, {
    required RepositoryHttpMethod method,
    Map<String, dynamic>? body,
  }) => _client.call(
    request: RepositoryHttpRequest(
      url: url,
      method: method,
      headers: const {'Content-Type': 'application/json'},
      body: body ?? const {},
    ),
  );

  void _throwIfError(RepositoryHttpResponse response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw UsersApiException.fromResponse(response);
    }
  }

  UserInvitation _parseInvitation(Map<String, dynamic> json) {
    final role = json['role'] as Map<String, dynamic>?;
    final roleName =
        (json['roleName'] as String?) ?? (role?['name'] as String?) ?? 'REP';
    final roleId = (json['roleId'] as String?) ?? role?['id'] as String?;
    final invitedBy = json['invitedBy'] as Map<String, dynamic>?;
    final composedInviter = [
      invitedBy?['firstName'],
      invitedBy?['lastName'],
    ].whereType<String>().join(' ').trim();
    final invitedByName =
        (json['invitedByName'] as String?) ??
        (composedInviter.isNotEmpty
            ? composedInviter
            : (invitedBy?['username'] as String?) ?? '—');

    return UserInvitation.fromJson({
      ...json,
      'email': json['email'] as String? ?? '',
      'roleName': roleName,
      'roleId': roleId,
      'invitedByName': invitedByName,
      'sectorAssignments':
          (json['sectorAssignments'] as List<dynamic>? ?? const []).map((raw) {
            final map = raw as Map<String, dynamic>;
            return {
              ...map,
              'sectorName': map['sectorName'] as String? ?? '—',
              'territories': (map['territories'] as List<dynamic>? ?? const [])
                  .map((t) {
                    final territory = t as Map<String, dynamic>;
                    return {
                      'id': territory['id'],
                      'name': territory['name'] ?? territory['id'],
                      if (territory['sectorId'] != null)
                        'sectorId': territory['sectorId'],
                      if (territory['sectorName'] != null)
                        'sectorName': territory['sectorName'],
                      if (territory['boundary'] != null)
                        'boundary': territory['boundary'],
                    };
                  })
                  .toList(),
            };
          }).toList(),
    });
  }

  List<Map<String, dynamic>> _sectorAssignmentsBody(
    List<InviteSectorAssignment> sectorAssignments,
  ) => sectorAssignments
      .map(
        (s) => {
          'sectorId': s.sectorId,
          if (s.managerId != null) 'managerId': s.managerId,
          'territoryIds': s.territoryIds,
        },
      )
      .toList();

  @override
  Future<List<UserInvitation>> getInvitations() async {
    final response = await _get(_uri('/invitations', {'limit': '100'}));
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = (decoded['invitations'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();
    return rows.map(_parseInvitation).toList();
  }

  @override
  Future<UserInvitation> getInvitation(String id) async {
    final response = await _get(_uri('/invitations/$id'));
    _throwIfError(response);
    return _parseInvitation(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<UserInvitation> createInvitation({
    required String email,
    required String firstName,
    required String lastName,
    required DateTime birthDate,
    required String phoneNumber,
    required String roleId,
    List<InviteSectorAssignment> sectorAssignments = const [],
  }) async {
    final response = await _send(
      _uri('/invite'),
      method: RepositoryHttpMethod.post,
      body: {
        if (email.trim().isNotEmpty) 'email': email.trim(),
        if (phoneNumber.trim().isNotEmpty) 'phoneNumber': phoneNumber.trim(),
        'firstName': firstName.trim(),
        'lastName': lastName.trim(),
        'birthDate': _dateOnly(birthDate),
        'roleId': roleId,
        if (sectorAssignments.isNotEmpty)
          'sectorAssignments': _sectorAssignmentsBody(sectorAssignments),
      },
    );
    _throwIfError(response);
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final invite = decoded['invite'] as Map<String, dynamic>?;
    final inviteId = invite?['id'] as String?;
    if (inviteId != null) {
      return getInvitation(inviteId);
    }
    // Fallback if create response is minimal.
    return UserInvitation(
      id: inviteId ?? 'unknown',
      email: email,
      roleName: '',
      roleId: roleId,
      status: InvitationStatus.pending,
      invitedByName: '—',
      firstName: firstName,
      lastName: lastName,
      birthDate: birthDate,
      phoneNumber: phoneNumber.isEmpty ? null : phoneNumber,
      sectorAssignments: sectorAssignments,
      createdAt: DateTime.now(),
      expiresAt: DateTime.now().add(const Duration(days: 7)),
      resendCount: 0,
    );
  }

  @override
  Future<UserInvitation> updateInvitation({
    required String id,
    required String email,
    required String firstName,
    required String lastName,
    required DateTime birthDate,
    required String phoneNumber,
    required String roleId,
    List<InviteSectorAssignment> sectorAssignments = const [],
  }) async {
    final response = await _send(
      _uri('/invites/$id'),
      method: RepositoryHttpMethod.patch,
      body: {
        if (email.trim().isNotEmpty) 'email': email.trim(),
        'phoneNumber': phoneNumber.trim().isEmpty ? null : phoneNumber.trim(),
        'firstName': firstName.trim(),
        'lastName': lastName.trim(),
        'birthDate': _dateOnly(birthDate),
        'roleId': roleId,
        'sectorAssignments': _sectorAssignmentsBody(sectorAssignments),
      },
    );
    _throwIfError(response);
    return _parseInvitation(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<void> resendInvitation(String id) async {
    final response = await _send(
      _uri('/invites/$id/resend'),
      method: RepositoryHttpMethod.post,
      body: const {},
    );
    _throwIfError(response);
  }

  @override
  Future<void> revokeInvitation(String id) async {
    final response = await _send(
      _uri('/invites/$id'),
      method: RepositoryHttpMethod.delete,
    );
    _throwIfError(response);
  }

  String _dateOnly(DateTime date) {
    final y = date.year.toString().padLeft(4, '0');
    final m = date.month.toString().padLeft(2, '0');
    final d = date.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }
}
