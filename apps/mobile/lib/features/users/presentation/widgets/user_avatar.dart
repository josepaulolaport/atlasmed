import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/session/repositories/session_environment.dart';
import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:flutter/material.dart';

/// Circular avatar for a managed [User] — shows the real `avatarUrl` when
/// present (with bearer-token auth, same as the drawer header), falling
/// back to deterministic initials otherwise.
class UserAvatar extends StatelessWidget {
  const UserAvatar({super.key, required this.user, this.size = 44});

  final User user;
  final double size;

  static const _palette = <Color>[
    Color(0xFF0A2F7F),
    Color(0xFF1D7A5F),
    Color(0xFFB45309),
    Color(0xFF7C3AED),
    Color(0xFFBE185D),
    Color(0xFF0E7490),
    Color(0xFF4338CA),
    Color(0xFF9A3412),
  ];

  Color get _backgroundColor {
    final hash = user.displayName.trim().toLowerCase().codeUnits.fold<int>(
      0,
      (acc, unit) => acc + unit,
    );
    return _palette[hash % _palette.length];
  }

  String get _initials {
    final parts = user.displayName
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '?';
    final first = parts.first[0];
    final last = parts.length > 1 ? parts.last[0] : '';
    return (first + last).toUpperCase();
  }

  String _avatarUri(String url) =>
      url.startsWith('http') ? url : '${AppConfig.apiBaseUrl}$url';

  @override
  Widget build(BuildContext context) {
    final avatarUrl = user.avatarUrl;
    final token = SessionEnvironment.instance.currentValue?.token;

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: _backgroundColor,
        shape: BoxShape.circle,
      ),
      child: avatarUrl != null && avatarUrl.isNotEmpty
          ? Image.network(
              _avatarUri(avatarUrl),
              headers: token == null
                  ? null
                  : {'Authorization': 'Bearer $token'},
              fit: BoxFit.cover,
              width: size,
              height: size,
              errorBuilder: (_, _, _) =>
                  _InitialsLabel(initials: _initials, size: size),
            )
          : _InitialsLabel(initials: _initials, size: size),
    );
  }
}

class _InitialsLabel extends StatelessWidget {
  const _InitialsLabel({required this.initials, required this.size});

  final String initials;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Text(
      initials,
      style: TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.w700,
        fontSize: size * 0.36,
      ),
    );
  }
}
