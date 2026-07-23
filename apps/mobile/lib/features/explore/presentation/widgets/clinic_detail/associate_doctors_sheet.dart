import 'dart:async';

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/facility_associate_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:go_router/go_router.dart';

/// Search + multi-select doctors to associate with a facility.
/// Returns the newly associated doctors (not already on the facility).
Future<List<FacilityCrmDoctor>?> showAssociateDoctorsSheet(
  BuildContext context, {
  required Set<String> alreadyAssociatedIds,
  String? facilityId,
}) {
  return showModalBottomSheet<List<FacilityCrmDoctor>>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _AssociateDoctorsSheet(
      alreadyAssociatedIds: alreadyAssociatedIds,
      facilityId: facilityId,
    ),
  );
}

class _AssociateDoctorsSheet extends StatefulWidget {
  const _AssociateDoctorsSheet({
    required this.alreadyAssociatedIds,
    this.facilityId,
  });

  final Set<String> alreadyAssociatedIds;
  final String? facilityId;

  @override
  State<_AssociateDoctorsSheet> createState() => _AssociateDoctorsSheetState();
}

class _AssociateDoctorsSheetState extends State<_AssociateDoctorsSheet> {
  List<FacilityCrmDoctor> _pool = const [];
  final Set<String> _selected = {};
  String _query = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;
  Timer? _debounce;

  bool get _useApi {
    final id = widget.facilityId;
    if (id == null || id.isEmpty) return false;
    return !id.startsWith('near-') && !id.endsWith(':empty');
  }

  @override
  void initState() {
    super.initState();
    _loadPool();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadPool({String? search}) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (!_useApi) {
        final pool = mockAssociableDoctors()
            .where((d) => !widget.alreadyAssociatedIds.contains(d.id))
            .toList();
        if (!mounted) return;
        setState(() {
          _pool = pool;
          _loading = false;
        });
        return;
      }

      final repo = FacilityAssociateRepository(widget.facilityId!);
      try {
        final pool = await repo.searchDoctors(search: search);
        final filtered = pool
            .where((d) => !widget.alreadyAssociatedIds.contains(d.id))
            .toList();
        if (!mounted) return;
        setState(() {
          _pool = filtered;
          _loading = false;
        });
      } finally {
        repo.dispose();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
        _pool = const [];
      });
    }
  }

  void _onQueryChanged(String q) {
    setState(() => _query = q);
    if (!_useApi) return;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _loadPool(search: q.trim().isEmpty ? null : q.trim());
    });
  }

  List<FacilityCrmDoctor> get _filtered {
    if (_useApi) return _pool;
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _pool;
    return _pool
        .where(
          (d) =>
              d.name.toLowerCase().contains(q) ||
              (d.specialty?.toLowerCase().contains(q) ?? false) ||
              (d.crm?.toLowerCase().contains(q) ?? false),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height * 0.88;
    final filtered = _filtered;

    return SizedBox(
      height: height,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFe5e7eb),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                const Text(
                  'Associar médicos',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0f1729),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Busque e selecione médicos para vincular a esta clínica.',
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF6b7280)),
                ),
                const SizedBox(height: 14),
                _ModalSearchField(
                  value: _query,
                  hintText: 'Buscar médico, especialidade, CRM…',
                  onChanged: _onQueryChanged,
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'Não foi possível carregar médicos.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13.5,
                              color: Color(0xFF9ca3af),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: () => _loadPool(
                              search: _query.trim().isEmpty
                                  ? null
                                  : _query.trim(),
                            ),
                            child: const Text('Tentar novamente'),
                          ),
                        ],
                      ),
                    ),
                  )
                : filtered.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        _query.isEmpty
                            ? 'Nenhum médico disponível para associar. Crie um perfil abaixo.'
                            : 'Nada encontrado para "$_query". Tente outro termo ou crie um perfil.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13.5,
                          color: Color(0xFF9ca3af),
                          height: 1.4,
                        ),
                      ),
                    ),
                  )
                : ListView.separated(
                    itemCount: filtered.length,
                    separatorBuilder: (_, _) => const Divider(
                      height: 1,
                      indent: 72,
                      color: Color(0xFFeef0f3),
                    ),
                    itemBuilder: (_, i) {
                      final d = filtered[i];
                      final selected = _selected.contains(d.id);
                      return CheckboxListTile(
                        value: selected,
                        onChanged: _saving
                            ? null
                            : (v) {
                                setState(() {
                                  if (v == true) {
                                    _selected.add(d.id);
                                  } else {
                                    _selected.remove(d.id);
                                  }
                                });
                              },
                        controlAffinity: ListTileControlAffinity.trailing,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                        ),
                        secondary: CircleAvatar(
                          backgroundColor: HSLColor.fromAHSL(
                            1,
                            d.hue,
                            0.48,
                            0.88,
                          ).toColor(),
                          child: Text(
                            d.initials,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: HSLColor.fromAHSL(
                                1,
                                d.hue,
                                0.55,
                                0.32,
                              ).toColor(),
                            ),
                          ),
                        ),
                        title: Text(
                          d.name,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0f1729),
                          ),
                        ),
                        subtitle: Text(
                          [
                            if (d.specialty != null) d.specialty!,
                            if (d.crm != null) d.crm!,
                          ].join(' · '),
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF6b7280),
                          ),
                        ),
                        activeColor: const Color(0xFF1e40af),
                      );
                    },
                  ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
              16,
              12,
              16,
              12 + MediaQuery.paddingOf(context).bottom,
            ),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFe5e7eb))),
              color: Colors.white,
            ),
            child: Column(
              children: [
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _saving ? null : _createProfile,
                    icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                    label: const Text('Criar perfil de médico'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1e40af),
                      side: const BorderSide(color: Color(0xFFdbeafe)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _selected.isEmpty || _saving ? null : _confirm,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1e40af),
                      disabledBackgroundColor: const Color(0xFFe5e7eb),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            _selected.isEmpty
                                ? 'Associar'
                                : 'Associar (${_selected.length})',
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _createProfile() async {
    final facilityId = widget.facilityId;
    final uri = facilityId == null || facilityId.isEmpty
        ? '/workspace/explore/doctors/new'
        : Uri(
            path: '/workspace/explore/doctors/new',
            queryParameters: {'facilityId': facilityId},
          ).toString();
    final created = await context.push<FacilityCrmDoctor>(uri);
    if (created == null || !mounted) return;
    setState(() {
      _pool = [created, ..._pool.where((d) => d.id != created.id)];
      _selected.add(created.id);
      _query = '';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${created.name} criado e selecionado'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _confirm() async {
    final chosen = _pool.where((d) => _selected.contains(d.id)).toList();
    if (chosen.isEmpty) return;

    if (!_useApi) {
      Navigator.of(context).pop(chosen);
      return;
    }

    // Doctors created via POST /professionals?facilityIds= already linked.
    // Only call associate for pool picks that were not just created into this
    // facility (create flow already associates).
    setState(() => _saving = true);
    final repo = FacilityAssociateRepository(widget.facilityId!);
    try {
      final associated = <FacilityCrmDoctor>[];
      for (final doctor in chosen) {
        // Re-associating is idempotent enough for UX; create-with-facility
        // already linked — associate again is fine / may no-op or refresh.
        await repo.associateDoctor(doctor.id);
        associated.add(doctor);
      }
      if (!mounted) return;
      Navigator.of(context).pop(associated);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is FacilityAssociateException
                ? (e.message ?? 'Falha ao associar')
                : 'Falha ao associar médicos',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      repo.dispose();
    }
  }
}

class _ModalSearchField extends StatefulWidget {
  const _ModalSearchField({
    required this.value,
    required this.hintText,
    required this.onChanged,
  });

  final String value;
  final String hintText;
  final ValueChanged<String> onChanged;

  @override
  State<_ModalSearchField> createState() => _ModalSearchFieldState();
}

class _ModalSearchFieldState extends State<_ModalSearchField> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
  }

  @override
  void didUpdateWidget(covariant _ModalSearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: const Color(0xFFf8f9fb),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFe5e7eb)),
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          const Icon(Icons.search_rounded, size: 18, color: Color(0xFF6b7280)),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _controller,
              onChanged: widget.onChanged,
              decoration: InputDecoration(
                hintText: widget.hintText,
                hintStyle: const TextStyle(color: Color(0xFF9ca3af)),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              style: const TextStyle(fontSize: 14, color: Color(0xFF0f1729)),
            ),
          ),
          if (widget.value.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.close_rounded, size: 18),
              color: const Color(0xFF6b7280),
              onPressed: () => widget.onChanged(''),
            ),
        ],
      ),
    );
  }
}
