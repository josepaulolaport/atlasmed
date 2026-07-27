import 'package:atlasmed_mobile_app/features/territories/data/models/app_user.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/user_avatar.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/user_picker_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

class ManagerPickerField extends ConsumerStatefulWidget {
  final String? managerTerritoryId;
  final String? verticalId;
  final ValueChanged<String?> onChanged;

  const ManagerPickerField({
    super.key,
    required this.managerTerritoryId,
    this.verticalId,
    required this.onChanged,
  });

  @override
  ConsumerState<ManagerPickerField> createState() => _ManagerPickerFieldState();
}

class _ManagerPickerFieldState extends ConsumerState<ManagerPickerField> {
  AppUser? _manager;
  String? _zoneName;
  String? _resolvedForZoneId;

  @override
  void initState() {
    super.initState();
    _resolveManager();
  }

  @override
  void didUpdateWidget(ManagerPickerField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.managerTerritoryId != widget.managerTerritoryId ||
        oldWidget.verticalId != widget.verticalId) {
      _resolveManager();
    }
  }

  Future<void> _resolveManager() async {
    final zoneId = widget.managerTerritoryId;
    if (zoneId == null) {
      setState(() {
        _manager = null;
        _zoneName = null;
        _resolvedForZoneId = null;
      });
      return;
    }

    _resolvedForZoneId = zoneId;
    final candidates = await ref
        .read(territoryRepositoryProvider)
        .getAssignableManagers(verticalId: widget.verticalId);
    if (!mounted || _resolvedForZoneId != zoneId) return;

    AppUser? manager;
    String? zoneName;
    for (final candidate in candidates) {
      if (candidate.zoneTerritoryId == zoneId) {
        manager = candidate.manager;
        zoneName = candidate.zoneName;
        break;
      }
    }
    setState(() {
      _manager = manager;
      _zoneName = zoneName;
    });
  }

  Future<void> _openPicker() async {
    final result = await UserPickerSheet.pickManagerForPatch(
      context,
      currentManagerTerritoryId: widget.managerTerritoryId,
      verticalId: widget.verticalId,
    );
    if (result == null) return;
    widget.onChanged(result);
  }

  @override
  Widget build(BuildContext context) {
    final hasSelection = widget.managerTerritoryId != null;

    return InkWell(
      onTap: widget.verticalId == null ? null : _openPicker,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.gray200),
        ),
        child: Row(
          children: [
            if (_manager != null) ...[
              UserAvatar.forUser(_manager!, size: 28),
              const SizedBox(width: 10),
            ] else
              const Padding(
                padding: EdgeInsets.only(right: 10),
                child: Icon(
                  Icons.person_outline,
                  size: 22,
                  color: AppColors.gray400,
                ),
              ),
            Expanded(
              child: Text(
                hasSelection
                    ? '${_manager?.name ?? 'Carregando...'}${_zoneName != null ? ' ($_zoneName)' : ''}'
                    : widget.verticalId == null
                    ? 'Escolha o vertical primeiro'
                    : 'Selecionar gerente',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: hasSelection ? AppColors.gray950 : AppColors.gray400,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Icon(
              Icons.keyboard_arrow_down,
              size: 20,
              color: AppColors.gray500,
            ),
          ],
        ),
      ),
    );
  }
}
