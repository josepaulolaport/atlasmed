import 'package:atlasmed_mobile_app/features/territories/data/models/unassigned_facility.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Spec 0006: manager list of clinics in zone(s) without a consultant.
class UnassignedFacilitiesSheet extends ConsumerStatefulWidget {
  const UnassignedFacilitiesSheet({super.key, this.managerZoneId});

  final String? managerZoneId;

  static Future<void> show(BuildContext context, {String? managerZoneId}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => UnassignedFacilitiesSheet(managerZoneId: managerZoneId),
    );
  }

  @override
  ConsumerState<UnassignedFacilitiesSheet> createState() =>
      _UnassignedFacilitiesSheetState();
}

class _UnassignedFacilitiesSheetState
    extends ConsumerState<UnassignedFacilitiesSheet> {
  late Future<List<UnassignedFacility>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<UnassignedFacility>> _load() {
    return ref
        .read(territoryRepositoryProvider)
        .listUnassignedFacilities(managerZoneId: widget.managerZoneId);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.75,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.gray200,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Clínicas sem consultor',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
                ),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Clínicas na zona sem responsável. Toque para abrir e atribuir.',
                style: TextStyle(
                  fontSize: 13.5,
                  height: 1.35,
                  color: AppColors.gray600,
                ),
              ),
            ),
          ),
          const Divider(height: 1, color: AppColors.gray100),
          Flexible(
            child: FutureBuilder<List<UnassignedFacility>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (snapshot.hasError) {
                  return Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Não foi possível carregar a lista.',
                          style: TextStyle(color: AppColors.gray600),
                        ),
                        TextButton(
                          onPressed: () => setState(() => _future = _load()),
                          child: const Text('Tentar novamente'),
                        ),
                      ],
                    ),
                  );
                }
                final clinics = snapshot.data ?? const [];
                if (clinics.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(32),
                    child: Text(
                      'Nenhuma clínica sem consultor nesta visão.',
                      style: TextStyle(color: AppColors.gray500),
                      textAlign: TextAlign.center,
                    ),
                  );
                }
                return ListView.separated(
                  shrinkWrap: true,
                  padding: EdgeInsets.fromLTRB(0, 8, 0, 12 + bottom),
                  itemCount: clinics.length,
                  separatorBuilder: (_, _) =>
                      const Divider(height: 1, indent: 20, endIndent: 20),
                  itemBuilder: (context, index) {
                    final clinic = clinics[index];
                    return ListTile(
                      title: Text(
                        clinic.displayName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                      subtitle: clinic.managerZoneName != null
                          ? Text(
                              clinic.managerZoneName!,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.gray600,
                              ),
                            )
                          : null,
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () {
                        Navigator.of(context).pop();
                        context.push('/explore/clinic/${clinic.id}');
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
