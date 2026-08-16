import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// One row of the editor: a catalogue entry the record may hold.
class TagOption {
  const TagOption({required this.id, required this.label});

  final int id;
  final String label;
}

/// What the sheet gives back — the whole selection, and which entry is primary.
class TagEditorResult {
  const TagEditorResult({required this.selectedIds, required this.primaryId});

  final Set<int> selectedIds;
  final int? primaryId;
}

/// The wording the sheet uses, which is all that differs between a clinic's
/// focos clínicos and a doctor's especialidades.
class TagEditorCopy {
  const TagEditorCopy({
    required this.title,
    required this.searchHint,
    required this.notFound,
    required this.primaryHint,
  });

  final String title;
  final String searchHint;
  final String notFound;
  final String primaryHint;

  static const clinicalFocus = TagEditorCopy(
    title: 'Focos clínicos',
    searchHint: 'Buscar foco clínico…',
    notFound: 'Nenhum foco clínico encontrado.',
    primaryHint: 'Toque na estrela para definir o foco principal',
  );

  static const specialty = TagEditorCopy(
    title: 'Especialidades',
    searchHint: 'Buscar especialidade…',
    notFound: 'Nenhuma especialidade encontrada.',
    primaryHint: 'Toque na estrela para definir a especialidade principal',
  );
}

/// Pick several entries from a catalogue, one of them the primary.
///
/// Written once for both clinical focuses and specialties: the two differ only
/// in their wording and their catalogue, and the interaction — search, tick
/// several, star one — is the same question. It deliberately does not resemble
/// `SpecialtyFilterDrawer`'s "Aplicar": that one narrows a list and can be
/// dismissed freely, while this one writes to the record, so it saves and can
/// fail.
class TagEditorSheet extends StatefulWidget {
  const TagEditorSheet({
    super.key,
    required this.copy,
    required this.options,
    required this.initialSelectedIds,
    required this.initialPrimaryId,
    required this.onSave,
  });

  final TagEditorCopy copy;
  final List<TagOption> options;
  final Set<int> initialSelectedIds;
  final int? initialPrimaryId;

  /// Performs the write. Throwing shows the message and keeps the sheet open
  /// with the user's selection intact — losing it would mean picking twelve
  /// focuses again over one dropped request.
  final Future<void> Function(TagEditorResult result) onSave;

  static Future<TagEditorResult?> show(
    BuildContext context, {
    required TagEditorCopy copy,
    required List<TagOption> options,
    required Set<int> selectedIds,
    required int? primaryId,
    required Future<void> Function(TagEditorResult result) onSave,
  }) {
    return showModalBottomSheet<TagEditorResult>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      // A half-finished selection is worth a confirmation tap to discard, and
      // the sheet can be closed from the handle either way.
      isDismissible: true,
      builder: (_) => TagEditorSheet(
        copy: copy,
        options: options,
        initialSelectedIds: selectedIds,
        initialPrimaryId: primaryId,
        onSave: onSave,
      ),
    );
  }

  @override
  State<TagEditorSheet> createState() => _TagEditorSheetState();
}

class _TagEditorSheetState extends State<TagEditorSheet> {
  late Set<int> _selected;
  late int? _primaryId;
  final _queryController = TextEditingController();
  String _query = '';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _selected = Set<int>.from(widget.initialSelectedIds);
    _primaryId = widget.initialPrimaryId;
  }

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  void _toggle(int id) {
    setState(() {
      if (_selected.remove(id)) {
        // Unticking the primary clears it too. Leaving it set would send a
        // primary the record no longer holds, which the server rejects.
        if (_primaryId == id) _primaryId = null;
      } else {
        _selected.add(id);
      }
    });
  }

  void _setPrimary(int id) {
    setState(() {
      if (_primaryId == id) {
        _primaryId = null;
      } else {
        _primaryId = id;
        // Starring something not yet ticked selects it, rather than silently
        // doing nothing.
        _selected.add(id);
      }
    });
  }

  List<TagOption> get _visible {
    final query = _fold(_query.trim());
    if (query.isEmpty) return widget.options;
    return widget.options
        .where((option) => _fold(option.label).contains(query))
        .toList(growable: false);
  }

  static String _fold(String value) {
    const accents = {
      'á': 'a',
      'à': 'a',
      'ã': 'a',
      'â': 'a',
      'é': 'e',
      'ê': 'e',
      'í': 'i',
      'ó': 'o',
      'ô': 'o',
      'õ': 'o',
      'ú': 'u',
      'ç': 'c',
    };
    var folded = value.toLowerCase();
    accents.forEach((from, to) => folded = folded.replaceAll(from, to));
    return folded;
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    final result = TagEditorResult(
      selectedIds: Set<int>.from(_selected),
      primaryId: _primaryId,
    );
    try {
      await widget.onSave(result);
      if (!mounted) return;
      Navigator.pop(context, result);
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$error'), behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final visible = _visible;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: DraggableScrollableSheet(
        initialChildSize: 0.78,
        minChildSize: 0.45,
        maxChildSize: 0.94,
        expand: false,
        builder: (context, scrollController) {
          return Material(
            color: Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 10),
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.gray300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 12, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.copy.title,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: AppColors.gray900,
                            letterSpacing: -0.2,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: _selected.isEmpty || _saving
                            ? null
                            : () => setState(() {
                                _selected.clear();
                                _primaryId = null;
                              }),
                        child: const Text('Limpar'),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                  child: TextField(
                    key: const Key('tag-editor-search'),
                    controller: _queryController,
                    onChanged: (value) => setState(() => _query = value),
                    decoration: InputDecoration(
                      hintText: widget.copy.searchHint,
                      prefixIcon: const Icon(Icons.search_rounded, size: 20),
                      isDense: true,
                      filled: true,
                      fillColor: AppColors.gray100,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      _selected.isEmpty
                          ? widget.copy.primaryHint
                          : '${_selected.length} selecionada${_selected.length == 1 ? '' : 's'} · ${widget.copy.primaryHint.toLowerCase()}',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.gray500,
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: visible.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              widget.copy.notFound,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 14,
                                color: AppColors.gray500,
                              ),
                            ),
                          ),
                        )
                      : ListView.builder(
                          controller: scrollController,
                          itemCount: visible.length,
                          itemBuilder: (context, index) {
                            final option = visible[index];
                            final selected = _selected.contains(option.id);
                            final primary = _primaryId == option.id;
                            return ListTile(
                              key: Key('tag-option-${option.id}'),
                              onTap: _saving ? null : () => _toggle(option.id),
                              leading: Checkbox(
                                value: selected,
                                onChanged: _saving
                                    ? null
                                    : (_) => _toggle(option.id),
                              ),
                              title: Text(
                                option.label,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: primary
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  color: AppColors.gray900,
                                ),
                              ),
                              trailing: IconButton(
                                key: Key('tag-primary-${option.id}'),
                                tooltip: primary
                                    ? 'Remover como principal'
                                    : 'Definir como principal',
                                onPressed: _saving
                                    ? null
                                    : () => _setPrimary(option.id),
                                icon: Icon(
                                  primary
                                      ? Icons.star_rounded
                                      : Icons.star_outline_rounded,
                                  color: primary
                                      ? const Color(0xFFb45309)
                                      : AppColors.gray300,
                                ),
                              ),
                            );
                          },
                        ),
                ),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
                    child: SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: FilledButton(
                        key: const Key('tag-editor-save'),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.navyBright,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: _saving ? null : _save,
                        child: _saving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Salvar',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
