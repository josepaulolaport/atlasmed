import 'package:flutter/material.dart';

/// Frosted glass input with floating label, focus glow, error state.
class GlassInput extends StatefulWidget {
  final String label;
  final String? value;
  final ValueChanged<String>? onChanged;
  final TextInputType keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final Widget? icon;
  final Widget? trailing;
  final bool error;
  final bool enabled;
  final FocusNode? focusNode;

  const GlassInput({
    super.key,
    required this.label,
    this.value,
    this.onChanged,
    this.keyboardType = TextInputType.text,
    this.textInputAction,
    this.obscureText = false,
    this.icon,
    this.trailing,
    this.error = false,
    this.enabled = true,
    this.focusNode,
  });

  @override
  State<GlassInput> createState() => _GlassInputState();
}

class _GlassInputState extends State<GlassInput> {
  late bool _obscured;
  late TextEditingController _controller;
  late FocusNode _focusNode;
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _obscured = widget.obscureText;
    _controller = TextEditingController(text: widget.value ?? '');
    _focusNode = widget.focusNode ?? FocusNode();
    _focusNode.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(GlassInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != oldWidget.value && widget.value != _controller.text) {
      _controller.text = widget.value ?? '';
    }
    if (widget.focusNode != oldWidget.focusNode) {
      oldWidget.focusNode?.removeListener(_onFocusChange);
      _focusNode = widget.focusNode ?? FocusNode();
      _focusNode.addListener(_onFocusChange);
    }
  }

  void _onFocusChange() {
    setState(() => _focused = _focusNode.hasFocus);
  }

  @override
  void dispose() {
    _controller.dispose();
    if (widget.focusNode == null) _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filled = _controller.text.isNotEmpty;
    final active = _focused || filled;

    final bgColor = widget.error
        ? const Color(0x1FFF5A5A)
        : _focused
            ? Colors.white.withValues(alpha: 0.18)
            : Colors.white.withValues(alpha: 0.09);

    final borderColor = widget.error
        ? const Color(0x99FF7878)
        : _focused
            ? Colors.white.withValues(alpha: 0.5)
            : Colors.white.withValues(alpha: 0.18);

    return Container(
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: bgColor,
        border: Border.all(color: borderColor),
        boxShadow: _focused
            ? [
                BoxShadow(
                  color: Colors.white.withValues(alpha: 0.08),
                  blurRadius: 4,
                  spreadRadius: 4,
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Stack(
        children: [
          // Floating label
          Positioned(
            left: widget.icon != null ? 48 : 16,
            top: active ? 10 : null,
            bottom: active ? null : 0,
            child: Center(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                child: Text(
                  widget.label,
                  style: TextStyle(
                    fontSize: active ? 11 : 15,
                    letterSpacing: active ? 0.6 : 0,
                    color: widget.error
                        ? const Color(0xE6FFB4B4)
                        : Colors.white70,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
            ),
          ),
          // Input row
          Row(
            children: [
              if (widget.icon != null)
                Padding(
                  padding: const EdgeInsets.only(left: 16),
                  child: IconTheme(
                    data: const IconThemeData(color: Colors.white70),
                    child: widget.icon!,
                  ),
                ),
              SizedBox(width: widget.icon != null ? 0 : 16),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    top: active ? 14 : 0,
                    right: widget.trailing != null ? 8 : 16,
                  ),
                  child: TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    onChanged: widget.onChanged,
                    enabled: widget.enabled,
                    obscureText: _obscured,
                    keyboardType: widget.keyboardType,
                    textInputAction: widget.textInputAction,
                    style: const TextStyle(
                      fontSize: 15,
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.1,
                    ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
              ),
              if (widget.trailing != null) widget.trailing!,
            ],
          ),
        ],
      ),
    );
  }
}
