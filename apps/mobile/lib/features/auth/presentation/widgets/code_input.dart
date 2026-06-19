import 'package:flutter/material.dart';

/// 6-digit OTP code input with segmented fields.
class CodeInput extends StatefulWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final bool error;

  const CodeInput({
    super.key,
    required this.value,
    required this.onChanged,
    this.error = false,
  });

  @override
  State<CodeInput> createState() => _CodeInputState();
}

class _CodeInputState extends State<CodeInput> {
  late List<FocusNode> _focusNodes;
  late List<TextEditingController> _controllers;

  @override
  void initState() {
    super.initState();
    _focusNodes = List.generate(6, (_) => FocusNode());
    _controllers = List.generate(6, (_) => TextEditingController());
    _syncFromValue(widget.value);
  }

  @override
  void didUpdateWidget(CodeInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != oldWidget.value) {
      _syncFromValue(widget.value);
    }
  }

  void _syncFromValue(String v) {
    for (var i = 0; i < 6; i++) {
      _controllers[i].text = i < v.length ? v[i] : '';
    }
  }

  @override
  void dispose() {
    for (final n in _focusNodes) { n.dispose(); }
    for (final c in _controllers) { c.dispose(); }
    super.dispose();
  }

  void _onDigitChanged(int index, String char) {
    final digit = char.isNotEmpty ? char.characters.first : '';
    _controllers[index].text = digit;

    final buf = StringBuffer();
    for (var i = 0; i < 6; i++) {
      buf.write(_controllers[i].text.isNotEmpty ? _controllers[i].text : '');
    }
    widget.onChanged(buf.toString());

    if (digit.isNotEmpty && index < 5) {
      _focusNodes[index + 1].requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(6, (i) {
        final filled = _controllers[i].text.isNotEmpty;
        return Padding(
          padding: EdgeInsets.only(
            left: i > 0 ? 8 : 0,
            right: 0,
          ),
          child: SizedBox(
            width: (MediaQuery.of(context).size.width - 28 * 2 - 8 * 5) / 6,
            height: 60,
            child: TextField(
              controller: _controllers[i],
              focusNode: _focusNodes[i],
              textAlign: TextAlign.center,
              keyboardType: TextInputType.number,
              maxLength: 1,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
              decoration: InputDecoration(
                counterText: '',
                filled: true,
                fillColor: filled
                    ? Colors.white.withValues(alpha: 0.18)
                    : Colors.white.withValues(alpha: 0.08),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: widget.error
                        ? const Color(0xB2FF7878)
                        : filled
                            ? Colors.white.withValues(alpha: 0.5)
                            : Colors.white.withValues(alpha: 0.2),
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: widget.error
                        ? const Color(0xB2FF7878)
                        : filled
                            ? Colors.white.withValues(alpha: 0.5)
                            : Colors.white.withValues(alpha: 0.2),
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: widget.error
                        ? const Color(0xB2FF7878)
                        : Colors.white.withValues(alpha: 0.5),
                  ),
                ),
                contentPadding: EdgeInsets.zero,
                isDense: true,
              ),
              onChanged: (v) => _onDigitChanged(i, v),
              onTap: () {
                if (_controllers[i].text.isNotEmpty) {
                  _controllers[i].selection = TextSelection(
                    baseOffset: 0,
                    extentOffset: _controllers[i].text.length,
                  );
                }
              },
            ),
          ),
        );
      }),
    );
  }
}
