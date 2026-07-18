import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:flutter/material.dart';

/// Modal table for picking a manager — each row shows avatar, name and
/// their territory (or "Sem território"). Returns the selected
/// [ManagerOption] id via [Navigator.pop], or `null` if dismissed.
class ManagerPickerSheet extends StatefulWidget {
  const ManagerPickerSheet({
    super.key,
    required this.managers,
    this.selectedId,
  });

  final List<ManagerOption> managers;
  final String? selectedId;

  static Future<String?> show(
    BuildContext context, {
    required List<ManagerOption> managers,
    String? selectedId,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => ManagerPickerSheet(
        managers: managers,
        selectedId: selectedId,
      ),
    );
  }

  @override
  State<ManagerPickerSheet> createState() => _ManagerPickerSheetState();
}

class _ManagerPickerSheetState extends State<ManagerPickerSheet> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<ManagerOption> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return widget.managers;
    return widget.managers.where((m) {
      final name = m.name.toLowerCase();
      final territory = (m.territoryName ?? '').toLowerCase();
      return name.contains(q) || territory.contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final maxHeight = MediaQuery.sizeOf(context).height * 0.72;
    final filtered = _filtered;

    return SafeArea(
      child: SizedBox(
        height: maxHeight,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 4, 20, 12),
              child: Text(
                'Selecionar gerente',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => _query = value),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Buscar por nome ou território',
                  isDense: true,
                  prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  suffixIcon: _query.isEmpty
                      ? null
                      : IconButton(
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _query = '');
                          },
                          icon: const Icon(Icons.close_rounded, size: 18),
                        ),
                  filled: true,
                  fillColor: const Color(0xFFf7f8fb),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFFeef0f3)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFFeef0f3)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF0a2f7f)),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
              ),
            ),
            const Divider(height: 1, color: Color(0xFFeef0f3)),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 8),
              child: Row(
                children: const [
                  SizedBox(width: 44),
                  Expanded(
                    flex: 3,
                    child: Text(
                      'Nome',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF9ca3af),
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  Expanded(
                    flex: 3,
                    child: Text(
                      'Território',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF9ca3af),
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  SizedBox(width: 28),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFeef0f3)),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text(
                        widget.managers.isEmpty
                            ? 'Nenhum gerente disponível.'
                            : 'Nenhum gerente encontrado.',
                        style: const TextStyle(color: Color(0xFF6b7280)),
                      ),
                    )
                  : ListView.separated(
                      itemCount: filtered.length,
                      separatorBuilder: (_, _) =>
                          const Divider(height: 1, color: Color(0xFFf1f3f6)),
                      itemBuilder: (context, index) {
                        final manager = filtered[index];
                        final selected = manager.id == widget.selectedId;
                        return InkWell(
                          onTap: () => Navigator.pop(context, manager.id),
                          child: Container(
                            color: selected
                                ? const Color(0xFF0a2f7f).withValues(alpha: 0.06)
                                : null,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 12,
                            ),
                            child: Row(
                              children: [
                                _ManagerAvatar(manager: manager),
                                const SizedBox(width: 12),
                                Expanded(
                                  flex: 3,
                                  child: Text(
                                    manager.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: selected
                                          ? FontWeight.w700
                                          : FontWeight.w600,
                                      color: const Color(0xFF0f1729),
                                    ),
                                  ),
                                ),
                                Expanded(
                                  flex: 3,
                                  child: Text(
                                    manager.territoryName ?? 'Sem território',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      color: manager.territoryName == null
                                          ? const Color(0xFF9ca3af)
                                          : const Color(0xFF6b7280),
                                    ),
                                  ),
                                ),
                                SizedBox(
                                  width: 28,
                                  child: selected
                                      ? const Icon(
                                          Icons.check_circle_rounded,
                                          size: 20,
                                          color: Color(0xFF0a2f7f),
                                        )
                                      : null,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ManagerAvatar extends StatelessWidget {
  const _ManagerAvatar({required this.manager});

  final ManagerOption manager;

  static const _palette = <Color>[
    Color(0xFF0A2F7F),
    Color(0xFF1D7A5F),
    Color(0xFFB45309),
    Color(0xFF7C3AED),
    Color(0xFFBE185D),
    Color(0xFF0E7490),
  ];

  Color get _backgroundColor {
    final hash = manager.name.trim().toLowerCase().codeUnits.fold<int>(
      0,
      (acc, unit) => acc + unit,
    );
    return _palette[hash % _palette.length];
  }

  String get _initials {
    final parts = manager.name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    final first = parts.first[0];
    final last = parts.length > 1 ? parts.last[0] : '';
    return (first + last).toUpperCase();
  }

  String _avatarUri(String url) =>
      url.startsWith('http') ? url : '${AppConfig.apiBaseUrl}$url';

  @override
  Widget build(BuildContext context) {
    final avatarUrl = manager.avatarUrl;
    final token = SessionEnvironment.instance.currentValue?.token;

    return Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: _backgroundColor,
        shape: BoxShape.circle,
      ),
      child: avatarUrl != null && avatarUrl.isNotEmpty
          ? Image.network(
              _avatarUri(avatarUrl),
              headers: token == null
                  ? null
                  : {'Authorization': 'Bearer $token'},
              fit: BoxFit.cover,
              width: 36,
              height: 36,
              errorBuilder: (_, _, _) => Text(
                _initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            )
          : Text(
              _initials,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
    );
  }
}
