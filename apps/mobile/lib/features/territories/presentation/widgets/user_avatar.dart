import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:flutter/material.dart';

/// Small circular avatar showing a user's initials on a deterministic
/// background color (no network image — there's no `avatarUrl` in the mock
/// model, and initials keep the picker/detail rows fast and offline-safe).
class UserAvatar extends StatelessWidget {
  final String name;
  final double size;

  const UserAvatar({super.key, required this.name, this.size = 32});

  factory UserAvatar.forUser(AppUser user, {double size = 32, Key? key}) {
    return UserAvatar(key: key, name: user.name, size: size);
  }

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
    final hash = name.trim().toLowerCase().codeUnits.fold<int>(
      0,
      (acc, unit) => acc + unit,
    );
    return _palette[hash % _palette.length];
  }

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '?';
    final first = parts.first[0];
    final last = parts.length > 1 ? parts.last[0] : '';
    return (first + last).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: _backgroundColor,
        shape: BoxShape.circle,
      ),
      child: Text(
        _initials,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: size * 0.36,
        ),
      ),
    );
  }
}
