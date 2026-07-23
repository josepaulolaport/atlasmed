import 'package:atlasmed_mobile_app/core/user/models/user_role_name.dart';
import 'package:atlasmed_mobile_app/core/user/models/user_status.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/users_filter.dart';
import 'package:flutter/material.dart';

class UsersFilterSheet extends StatefulWidget {
  const UsersFilterSheet({
    super.key,
    required this.filter,
    required this.onApply,
  });

  final UsersFilter filter;
  final void Function(UsersFilter filter) onApply;

  @override
  State<UsersFilterSheet> createState() => _UsersFilterSheetState();
}

class _UsersFilterSheetState extends State<UsersFilterSheet> {
  late UserRoleName? _role;
  late UserStatus? _status;
  late UsersSortBy _sortBy;
  late UsersSortDir _sortDir;

  @override
  void initState() {
    super.initState();
    _role = widget.filter.role;
    _status = widget.filter.status;
    _sortBy = widget.filter.sortBy;
    _sortDir = widget.filter.sortDir;
  }

  void _selectSort(UsersSortBy next) {
    setState(() {
      if (_sortBy == next) return;
      _sortBy = next;
      _sortDir = next == UsersSortBy.createdAt
          ? UsersSortDir.desc
          : UsersSortDir.asc;
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFe1e4ea),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Filtrar usuários',
              style: TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Função',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6b7280),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: UserRoleName.values.map((role) {
                final selected = _role == role;
                return _Chip(
                  label: role.label,
                  color: role.color,
                  selected: selected,
                  onTap: () => setState(() => _role = selected ? null : role),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),
            const Text(
              'Status',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6b7280),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: UserStatus.values.map((status) {
                final selected = _status == status;
                return _Chip(
                  label: status.label,
                  color: status.color,
                  selected: selected,
                  onTap: () =>
                      setState(() => _status = selected ? null : status),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),
            const Text(
              'Ordenar por',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6b7280),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: UsersSortBy.values.map((sortBy) {
                final selected = _sortBy == sortBy;
                return _Chip(
                  label: sortBy.label,
                  color: const Color(0xFF0a2f7f),
                  selected: selected,
                  onTap: () => _selectSort(sortBy),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: UsersSortDir.values.map((dir) {
                final selected = _sortDir == dir;
                return _Chip(
                  label: dir.labelFor(_sortBy),
                  color: const Color(0xFF0a2f7f),
                  selected: selected,
                  onTap: () => setState(() => _sortDir = dir),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _role = null;
                        _status = null;
                        _sortBy = UsersSortBy.createdAt;
                        _sortDir = UsersSortDir.desc;
                      });
                    },
                    child: const Text('Limpar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0a2f7f),
                    ),
                    onPressed: () {
                      widget.onApply(
                        UsersFilter(
                          search: widget.filter.search,
                          role: _role,
                          status: _status,
                          sortBy: _sortBy,
                          sortDir: _sortDir,
                        ),
                      );
                      Navigator.of(context).pop();
                    },
                    child: const Text('Aplicar'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.12) : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? color : const Color(0xFFe5e7eb)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: selected ? color : const Color(0xFF374151),
          ),
        ),
      ),
    );
  }
}
