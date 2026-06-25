import 'package:flutter/material.dart';

class TabToggle extends StatelessWidget {
  final String value; // 'clinic' | 'doctor'
  final ValueChanged<String> onChanged;
  final int clinicCount;
  final int doctorCount;

  const TabToggle({
    super.key,
    required this.value,
    required this.onChanged,
    required this.clinicCount,
    required this.doctorCount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFeef0f3))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _Tab(
            label: 'Clínicas',
            count: clinicCount,
            selected: value == 'clinic',
            onTap: () => onChanged('clinic'),
          ),
          const SizedBox(width: 24),
          _Tab(
            label: 'Médicos',
            count: doctorCount,
            selected: value == 'doctor',
            onTap: () => onChanged('doctor'),
          ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _Tab({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Stack(
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: selected ? const Color(0xFF0a2f7f) : const Color(0xFF9ca3af),
                  ),
                ),
                const SizedBox(width: 7),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  height: 18,
                  decoration: BoxDecoration(
                    color: selected ? const Color(0xFFeef2ff) : const Color(0xFFf3f4f6),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Center(
                    child: Text(
                      '$count',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: selected ? const Color(0xFF0a2f7f) : const Color(0xFF9ca3af),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (selected)
              Positioned(
                left: 0,
                right: 0,
                bottom: -1,
                child: Container(
                  height: 2,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0a2f7f),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
