import 'package:flutter/material.dart';

class SearchBarWidget extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final VoidCallback onFilter;
  final int filterCount;
  final String hintText;

  const SearchBarWidget({
    super.key,
    required this.value,
    required this.onChanged,
    required this.onFilter,
    this.filterCount = 0,
    required this.hintText,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Container(
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFe5e7eb)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 2,
                  offset: Offset(0, 1),
                ),
              ],
            ),
            child: Row(
              children: [
                const SizedBox(width: 12),
                const Icon(Icons.search_rounded, size: 16, color: Color(0xFF6b7280)),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: TextEditingController.fromValue(
                      TextEditingValue(
                        text: value,
                        selection: TextSelection.collapsed(offset: value.length),
                      ),
                    ),
                    onChanged: onChanged,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF0f1729),
                    ),
                    decoration: InputDecoration(
                      hintText: hintText,
                      hintStyle: const TextStyle(color: Color(0xFF9ca3af)),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
                if (value.isNotEmpty)
                  GestureDetector(
                    onTap: () => onChanged(''),
                    child: Container(
                      width: 20,
                      height: 20,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFe5e7eb),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded, size: 10, color: Color(0xFF6b7280)),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: onFilter,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: filterCount > 0 ? const Color(0xFF1e40af) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFe5e7eb)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 2,
                  offset: Offset(0, 1),
                ),
              ],
            ),
            child: Stack(
              children: [
                Center(
                  child: Icon(
                    Icons.tune_rounded,
                    size: 18,
                    color: filterCount > 0 ? Colors.white : const Color(0xFF1e40af),
                  ),
                ),
                if (filterCount > 0)
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 16),
                      height: 16,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFe11d48),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          '$filterCount',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
