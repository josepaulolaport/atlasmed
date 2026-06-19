import 'package:flutter/material.dart';

class SearchableFilterOption {
  const SearchableFilterOption({
    required this.value,
    required this.label,
    this.subtitle,
  });

  final String value;
  final String label;
  final String? subtitle;
}

class SearchableFilterDropdown extends StatelessWidget {
  const SearchableFilterDropdown({
    super.key,
    required this.label,
    required this.hint,
    required this.selectedValues,
    required this.options,
    required this.onChanged,
    this.onSearch,
    this.searchHint = 'Buscar…',
  });

  final String label;
  final String hint;
  final List<String> selectedValues;
  final List<SearchableFilterOption> options;
  final ValueChanged<List<String>> onChanged;
  final Future<List<SearchableFilterOption>> Function(String query)? onSearch;
  final String searchHint;

  String get _summary {
    if (selectedValues.isEmpty) return hint;
    if (selectedValues.length == 1) {
      final match = options.where((o) => o.value == selectedValues.first);
      if (match.isNotEmpty) return match.first.label;
      return selectedValues.first;
    }
    return '${selectedValues.length} selecionados';
  }

  Future<void> _openPicker(BuildContext context) async {
    final result = await showModalBottomSheet<List<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _SearchablePickerSheet(
        title: label,
        initialSelection: selectedValues,
        options: options,
        onSearch: onSearch,
        searchHint: searchHint,
      ),
    );

    if (result != null) {
      onChanged(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasSelection = selectedValues.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
              color: Color(0xFF6b7280),
            ),
          ),
          const SizedBox(height: 8),
          InkWell(
            onTap: () => _openPicker(context),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              decoration: BoxDecoration(
                color: const Color(0xFFf9fafb),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: hasSelection
                      ? const Color(0xFF1e40af)
                      : const Color(0xFFe5e7eb),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _summary,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: hasSelection ? FontWeight.w600 : FontWeight.w500,
                        color: hasSelection
                            ? const Color(0xFF0f1729)
                            : const Color(0xFF9ca3af),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Icon(
                    Icons.expand_more_rounded,
                    color: hasSelection
                        ? const Color(0xFF1e40af)
                        : const Color(0xFF9ca3af),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchablePickerSheet extends StatefulWidget {
  const _SearchablePickerSheet({
    required this.title,
    required this.initialSelection,
    required this.options,
    this.onSearch,
    required this.searchHint,
  });

  final String title;
  final List<String> initialSelection;
  final List<SearchableFilterOption> options;
  final Future<List<SearchableFilterOption>> Function(String query)? onSearch;
  final String searchHint;

  @override
  State<_SearchablePickerSheet> createState() => _SearchablePickerSheetState();
}

class _SearchablePickerSheetState extends State<_SearchablePickerSheet> {
  late Set<String> _selected;
  late List<SearchableFilterOption> _visibleOptions;
  final _searchController = TextEditingController();
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _selected = widget.initialSelection.toSet();
    _visibleOptions = widget.options;
    _searchController.addListener(_handleSearchChanged);
    if (widget.onSearch != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _handleSearchChanged());
    }
  }

  @override
  void dispose() {
    _searchController.removeListener(_handleSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _handleSearchChanged() async {
    final query = _searchController.text.trim();

    if (widget.onSearch != null) {
      setState(() => _searching = true);
      try {
        final results = await widget.onSearch!(query);
        if (!mounted) return;
        setState(() {
          _visibleOptions = results;
          _searching = false;
        });
      } catch (_) {
        if (mounted) setState(() => _searching = false);
      }
      return;
    }

    final lower = query.toLowerCase();
    setState(() {
      _visibleOptions = query.isEmpty
          ? widget.options
          : widget.options
              .where(
                (option) =>
                    option.label.toLowerCase().contains(lower) ||
                    option.value.toLowerCase().contains(lower) ||
                    (option.subtitle?.toLowerCase().contains(lower) ?? false),
              )
              .toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final maxHeight = MediaQuery.sizeOf(context).height * 0.78;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: maxHeight),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFd1d5db),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0f1729),
                      ),
                    ),
                  ),
                  if (_selected.isNotEmpty)
                    TextButton(
                      onPressed: () => setState(() => _selected.clear()),
                      child: const Text('Limpar'),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: widget.searchHint,
                  prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  filled: true,
                  fillColor: const Color(0xFFf3f4f6),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _searching
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  : _visibleOptions.isEmpty
                      ? const Center(
                          child: Text(
                            'Nenhum resultado',
                            style: TextStyle(color: Color(0xFF9ca3af)),
                          ),
                        )
                      : ListView.builder(
                          itemCount: _visibleOptions.length,
                          itemBuilder: (context, index) {
                            final option = _visibleOptions[index];
                            final checked = _selected.contains(option.value);
                            return CheckboxListTile(
                              value: checked,
                              title: Text(
                                option.label,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              subtitle: option.subtitle != null
                                  ? Text(
                                      option.subtitle!,
                                      style: const TextStyle(fontSize: 12),
                                    )
                                  : null,
                              controlAffinity: ListTileControlAffinity.leading,
                              onChanged: (value) {
                                setState(() {
                                  if (value == true) {
                                    _selected.add(option.value);
                                  } else {
                                    _selected.remove(option.value);
                                  }
                                });
                              },
                            );
                          },
                        ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context, _selected.toList()),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1e40af),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      'Confirmar${_selected.isEmpty ? '' : ' (${_selected.length})'}',
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
