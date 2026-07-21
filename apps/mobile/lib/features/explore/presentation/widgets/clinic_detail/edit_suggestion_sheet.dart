import 'package:flutter/material.dart';

/// Shared bottom sheet for the "tap a pencil, suggest an edit" pattern.
///
/// Phase 1 (mocked): submission just shows a confirmation snackbar — no
/// network call. Phase 2 wires this to a suggestion-submission endpoint that
/// reuses the existing `FACILITY_FIELD_UPDATE` review pipeline so changes
/// still pass through administrative review before landing on the profile.
Future<void> showEditSuggestionSheet(
  BuildContext context, {
  required String fieldLabel,
  required String? currentValue,
}) async {
  // Opening a route in the same frame as an InkWell/Tooltip interaction can
  // race InheritedWidget teardown (`_dependents.isEmpty`). Wait one frame.
  await Future<void>.delayed(Duration.zero);
  if (!context.mounted) return;

  final messenger = ScaffoldMessenger.maybeOf(context);
  final submitted = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      return _EditSuggestionSheetBody(
        fieldLabel: fieldLabel,
        currentValue: currentValue,
      );
    },
  );

  if (submitted == true && messenger != null) {
    messenger.showSnackBar(
      const SnackBar(
        content: Text('Sugestão enviada para revisão'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _EditSuggestionSheetBody extends StatefulWidget {
  const _EditSuggestionSheetBody({
    required this.fieldLabel,
    required this.currentValue,
  });

  final String fieldLabel;
  final String? currentValue;

  @override
  State<_EditSuggestionSheetBody> createState() =>
      _EditSuggestionSheetBodyState();
}

class _EditSuggestionSheetBodyState extends State<_EditSuggestionSheetBody> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.currentValue ?? '');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFe5e7eb),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const Text(
            'Sugerir alteração',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0f1729),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.fieldLabel.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: Color(0xFF9ca3af),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            autofocus: true,
            maxLines: 3,
            minLines: 1,
            decoration: InputDecoration(
              hintText: 'Novo valor para ${widget.fieldLabel}',
              filled: true,
              fillColor: const Color(0xFFf8f9fb),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Sua sugestão passa por revisão administrativa antes de entrar no perfil.',
            style: TextStyle(fontSize: 11.5, color: Color(0xFF9ca3af)),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF1e40af),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Enviar sugestão'),
            ),
          ),
        ],
      ),
    );
  }
}
