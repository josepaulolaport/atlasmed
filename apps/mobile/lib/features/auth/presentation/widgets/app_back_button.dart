import 'package:flutter/material.dart';

/// Glass back button with chevron icon.
class AppBackButton extends StatelessWidget {
  final VoidCallback? onTap;

  const AppBackButton({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 40,
      height: 40,
      child: Material(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: const Center(
            child: Icon(
              Icons.chevron_left,
              color: Colors.white,
              size: 22,
            ),
          ),
        ),
      ),
    );
  }
}
