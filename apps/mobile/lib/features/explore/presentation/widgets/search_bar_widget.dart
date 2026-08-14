import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class SearchBarWidget extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;

  /// Null hides the filter button — a surface with nothing to filter should not
  /// show a control that does nothing.
  final VoidCallback? onFilter;
  final int filterCount;
  final String hintText;

  const SearchBarWidget({
    super.key,
    required this.value,
    required this.onChanged,
    this.onFilter,
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
              border: Border.all(color: AppColors.gray200),
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
                const Icon(
                  Icons.search_rounded,
                  size: 16,
                  color: AppColors.gray500,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: TextEditingController.fromValue(
                      TextEditingValue(
                        text: value,
                        selection: TextSelection.collapsed(
                          offset: value.length,
                        ),
                      ),
                    ),
                    onChanged: onChanged,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.gray900,
                    ),
                    decoration: InputDecoration(
                      hintText: hintText,
                      hintStyle: const TextStyle(color: AppColors.gray400),
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
                        color: AppColors.gray200,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 10,
                        color: AppColors.gray500,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (onFilter != null) ...[
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onFilter,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: filterCount > 0 ? AppColors.navyBright : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.gray200),
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
                      color: filterCount > 0
                          ? Colors.white
                          : AppColors.navyBright,
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
                          color: AppColors.rose,
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
      ],
    );
  }
}
