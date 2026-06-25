import 'package:flutter/material.dart';

/// Footer with terms link and app version.
class TermsFooter extends StatelessWidget {
  final String version;

  const TermsFooter({super.key, this.version = 'v2.8.1'});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          RichText(
            textAlign: TextAlign.center,
            text: TextSpan(
              style: const TextStyle(
                color: Colors.white54,
                fontSize: 11,
                height: 1.5,
              ),
              children: [
                const TextSpan(text: 'Ao continuar, você concorda com os '),
                TextSpan(
                  text: 'Termos',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    decoration: TextDecoration.underline,
                  ),
                ),
                const TextSpan(text: ' e '),
                TextSpan(
                  text: 'Política de Privacidade',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    decoration: TextDecoration.underline,
                  ),
                ),
                const TextSpan(text: '.'),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'atlasmed · $version',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.35),
              fontSize: 11,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}
