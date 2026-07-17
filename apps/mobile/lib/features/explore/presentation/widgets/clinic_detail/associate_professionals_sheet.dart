import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/facility_associate_mock.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/create_admin_professional_sheet.dart';

/// Search + multi-select administrative professionals to associate.
Future<List<AdministrativeProfessional>?> showAssociateProfessionalsSheet(
  BuildContext context, {
  required Set<String> alreadyAssociatedIds,
}) {
  return showModalBottomSheet<List<AdministrativeProfessional>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _AssociateProfessionalsSheet(
      alreadyAssociatedIds: alreadyAssociatedIds,
    ),
  );
}

class _AssociateProfessionalsSheet extends StatefulWidget {
  const _AssociateProfessionalsSheet({required this.alreadyAssociatedIds});

  final Set<String> alreadyAssociatedIds;

  @override
  State<_AssociateProfessionalsSheet> createState() =>
      _AssociateProfessionalsSheetState();
}

class _AssociateProfessionalsSheetState
    extends State<_AssociateProfessionalsSheet> {
  late List<AdministrativeProfessional> _pool = mockAssociableProfessionals()
      .where((p) => !widget.alreadyAssociatedIds.contains(p.id))
      .toList();
  final Set<String> _selected = {};
  String _query = '';

  List<AdministrativeProfessional> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _pool;
    return _pool
        .where(
          (p) =>
              p.name.toLowerCase().contains(q) ||
              (p.roleTitle?.toLowerCase().contains(q) ?? false) ||
              p.contactTypeLabel.toLowerCase().contains(q),
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
                  'Associar profissionais',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0f1729),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Busque e selecione contatos administrativos para '
                  'vincular a esta clínica.',
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF6b7280)),
                ),
                const SizedBox(height: 14),
                _ModalSearchField(
                  value: _query,
                  hintText: 'Buscar nome, cargo…',
                  onChanged: (q) => setState(() => _query = q),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Text(
                      _query.isEmpty
                          ? 'Nenhum profissional disponível para associar'
                          : 'Nada encontrado para "$_query"',
                      style: const TextStyle(
                        fontSize: 13.5,
                        color: Color(0xFF9ca3af),
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
                      final p = filtered[i];
                      final selected = _selected.contains(p.id);
                      final initials = initialsFromName(p.name);
                      return CheckboxListTile(
                        value: selected,
                        onChanged: (v) {
                          setState(() {
                            if (v == true) {
                              _selected.add(p.id);
                            } else {
                              _selected.remove(p.id);
                            }
                          });
                        },
                        controlAffinity: ListTileControlAffinity.trailing,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                        ),
                        secondary: CircleAvatar(
                          backgroundColor: const Color(0xFFdbeafe),
                          child: Text(
                            initials,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1e3a8a),
                            ),
                          ),
                        ),
                        title: Text(
                          p.name,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0f1729),
                          ),
                        ),
                        subtitle: Text(
                          [
                            if (p.roleTitle != null) p.roleTitle!,
                            p.contactTypeLabel,
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
                    onPressed: _createProfile,
                    icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                    label: const Text('Criar perfil de profissional'),
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
                    onPressed: _selected.isEmpty ? null : _confirm,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1e40af),
                      disabledBackgroundColor: const Color(0xFFe5e7eb),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
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
    final created = await showCreateAdminProfessionalSheet(context);
    if (created == null || !mounted) return;
    setState(() {
      _pool = [created, ..._pool];
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

  void _confirm() {
    final chosen = _pool.where((p) => _selected.contains(p.id)).toList();
    Navigator.of(context).pop(chosen);
  }
}

class _ModalSearchField extends StatelessWidget {
  const _ModalSearchField({
    required this.value,
    required this.hintText,
    required this.onChanged,
  });

  final String value;
  final String hintText;
  final ValueChanged<String> onChanged;

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
              controller: TextEditingController.fromValue(
                TextEditingValue(
                  text: value,
                  selection: TextSelection.collapsed(offset: value.length),
                ),
              ),
              onChanged: onChanged,
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle: const TextStyle(color: Color(0xFF9ca3af)),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              style: const TextStyle(fontSize: 14, color: Color(0xFF0f1729)),
            ),
          ),
          if (value.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.close_rounded, size: 18),
              color: const Color(0xFF6b7280),
              onPressed: () => onChanged(''),
            ),
        ],
      ),
    );
  }
}
