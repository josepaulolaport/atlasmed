import 'package:atlasmed_mobile_app/core/user/models/user.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/user_avatar.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/widgets/user_badges.dart';
import 'package:flutter/material.dart';

class UserRow extends StatelessWidget {
  const UserRow({super.key, required this.user, required this.onTap});

  final User user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
        ),
        child: Row(
          children: [
            UserAvatar(user: user, size: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.displayName,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0f1729),
                      letterSpacing: -0.15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user.email,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF6b7280),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      RoleBadge(role: user.role.name, dense: true),
                      const SizedBox(width: 6),
                      StatusBadge(status: user.status, dense: true),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFFc8cdd5)),
          ],
        ),
      ),
    );
  }
}
