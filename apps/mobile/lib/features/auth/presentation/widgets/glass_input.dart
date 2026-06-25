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

  void _onFocusChange() => setState(() {});

  void _toggleObscured() => setState(() => _obscured = !_obscured);

  @override
  void dispose() {
    _controller.dispose();
    if (widget.focusNode == null) _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final focused = _focusNode.hasFocus;
    final borderRadius = BorderRadius.circular(14);

    return Container(
      height: 56,
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        boxShadow: focused
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
        decoration: InputDecoration(
          labelText: widget.label,
          labelStyle: TextStyle(
            fontSize: 15,
            color: widget.error ? const Color(0xE6FFB4B4) : Colors.white70,
            fontWeight: FontWeight.w400,
          ),
          floatingLabelStyle: const TextStyle(
            fontSize: 11,
            letterSpacing: 0.6,
            color: Colors.white70,
            fontWeight: FontWeight.w600,
          ),
          filled: true,
          fillColor: widget.error
              ? const Color(0x1FFF5A5A)
              : focused
                  ? Colors.white.withValues(alpha: 0.18)
                  : Colors.white.withValues(alpha: 0.09),
          prefixIcon: widget.icon != null
              ? Padding(
                  padding: const EdgeInsets.only(left: 16, right: 8),
                  child: IconTheme(
                    data: const IconThemeData(color: Colors.white70),
                    child: widget.icon!,
                  ),
                )
              : null,
          suffixIcon: widget.obscureText
              ? IconButton(
                  icon: Icon(
                    _obscured
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: Colors.white70,
                    size: 20,
                  ),
                  onPressed: _toggleObscured,
                )
              : null,
          enabledBorder: OutlineInputBorder(
            borderRadius: borderRadius,
            borderSide: BorderSide(
              color: widget.error
                  ? const Color(0x99FF7878)
                  : Colors.white.withValues(alpha: 0.18),
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: borderRadius,
            borderSide: BorderSide(
              color: widget.error
                  ? const Color(0x99FF7878)
                  : Colors.white.withValues(alpha: 0.5),
              width: 1.5,
            ),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: borderRadius,
            borderSide: const BorderSide(
              color: Color(0x99FF7878),
            ),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: borderRadius,
            borderSide: const BorderSide(
              color: Color(0x99FF7878),
              width: 1.5,
            ),
          ),
          contentPadding: EdgeInsets.only(
            left: widget.icon != null ? 12 : 16,
            right: widget.obscureText ? 12 : 16,
            top: 22,
            bottom: 10,
          ),
        ),
      ),
    );
  }
}
