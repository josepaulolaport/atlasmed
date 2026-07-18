import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/permission_grant.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

const _resourceOptions = <String>[
  'USER',
  'FACILITY',
  'PROFESSIONAL',
  'TERRITORY',
  'CATALOG',
];
const _actionOptions = <String>['read', 'create', 'update', 'delete', 'manage'];

/// Bottom sheet to grant/revoke `AccessGrant` overrides for a user. Mirrors
/// the web app's `ManagePermissionsDialog` —
/// `POST`/`DELETE /access/users/:id/permissions`.
class ManagePermissionsSheet extends ConsumerStatefulWidget {
  const ManagePermissionsSheet({
    super.key,
    required this.user,
    required this.grants,
  });

  final User user;
  final List<PermissionGrant> grants;

  static Future<void> show(
    BuildContext context, {
    required User user,
    required List<PermissionGrant> grants,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => ManagePermissionsSheet(user: user, grants: grants),
    );
  }

  @override
  ConsumerState<ManagePermissionsSheet> createState() =>
      _ManagePermissionsSheetState();
}

class _ManagePermissionsSheetState
    extends ConsumerState<ManagePermissionsSheet> {
  late List<PermissionGrant> _grants;
  bool _busy = false;
  String _resource = _resourceOptions.first;
  String _action = _actionOptions.first;

  @override
  void initState() {
    super.initState();
    _grants = List<PermissionGrant>.of(widget.grants);
  }

  Future<void> _reload() async {
    final updated = await ref
        .read(usersRepositoryProvider)
        .getUserPermissions(widget.user.id);
    if (mounted) setState(() => _grants = updated);
  }

  Future<void> _grant() async {
    setState(() => _busy = true);
    try {
      await ref
          .read(usersRepositoryProvider)
          .grantPermission(
            widget.user.id,
            resource: _resource,
            action: _action,
          );
      await _reload();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Não foi possível conceder a permissão.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revoke(String grantId) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(usersRepositoryProvider)
          .revokePermission(widget.user.id, grantId);
      await _reload();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Não foi possível revogar a permissão.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 10),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Permissões · ${widget.user.displayName}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF111827),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              if (_busy) const LinearProgressIndicator(minHeight: 2),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  children: [
                    const Text(
                      'Conceder nova permissão',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _resource,
                            decoration: const InputDecoration(
                              labelText: 'Recurso',
                              isDense: true,
                            ),
                            items: _resourceOptions
                                .map(
                                  (r) => DropdownMenuItem(
                                    value: r,
                                    child: Text(r),
                                  ),
                                )
                                .toList(),
                            onChanged: (v) =>
                                setState(() => _resource = v ?? _resource),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _action,
                            decoration: const InputDecoration(
                              labelText: 'Ação',
                              isDense: true,
                            ),
                            items: _actionOptions
                                .map(
                                  (a) => DropdownMenuItem(
                                    value: a,
                                    child: Text(a),
                                  ),
                                )
                                .toList(),
                            onChanged: (v) =>
                                setState(() => _action = v ?? _action),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF0a2f7f),
                        ),
                        onPressed: _busy ? null : _grant,
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Conceder'),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Divider(height: 1, color: Color(0xFFf1f3f6)),
                    const SizedBox(height: 12),
                    const Text(
                      'Permissões concedidas',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (_grants.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          'Nenhuma permissão extra concedida.',
                          style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFF9ca3af),
                          ),
                        ),
                      )
                    else
                      ...(_grants.map(
                        (grant) => Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFf9fafb),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFeef0f3)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${grant.action.toUpperCase()} · ${grant.resource}',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.delete_outline,
                                  size: 18,
                                  color: Color(0xFFB91C1C),
                                ),
                                onPressed: _busy
                                    ? null
                                    : () => _revoke(grant.id),
                              ),
                            ],
                          ),
                        ),
                      )),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
