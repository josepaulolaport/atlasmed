import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/providers/nao_conformidade_provider.dart';

/// Asks for a reason and submits a clinic-deactivation suggestion.
Future<void> requestClinicDeactivation(
  BuildContext context, {
  required WidgetRef ref,
  required String clinicId,
  required String clinicName,
  required FacilityCommercialStatus currentStatus,
}) async {
  await Future<void>.delayed(Duration.zero);
  if (!context.mounted) return;

  final messenger = ScaffoldMessenger.maybeOf(context);
  final reason = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _ClinicDeactivationSheetBody(
      clinicName: clinicName,
      currentStatus: currentStatus,
    ),
  );

  if (reason == null || reason.trim().isEmpty || !context.mounted) return;

  try {
    await ref
        .read(naoConformidadeActionsProvider)
        .submitDeactivation(facilityId: clinicId, reason: reason.trim());
    if (!context.mounted) return;
    messenger?.showSnackBar(
      const SnackBar(
        content: Text('Solicitação de desativação enviada para revisão'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    messenger?.showSnackBar(
      SnackBar(
        content: Text('Falha ao enviar solicitação: $e'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _ClinicDeactivationSheetBody extends StatefulWidget {
  const _ClinicDeactivationSheetBody({
    required this.clinicName,
    required this.currentStatus,
  });

  final String clinicName;
  final FacilityCommercialStatus currentStatus;

  @override
  State<_ClinicDeactivationSheetBody> createState() =>
      _ClinicDeactivationSheetBodyState();
}

class _ClinicDeactivationSheetBodyState
    extends State<_ClinicDeactivationSheetBody> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFe5e7eb),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const Text(
            'Solicitar desativação',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0f1729),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            widget.clinicName,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF1e40af),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Status comercial atual: ${widget.currentStatus.label}. '
            'A solicitação pedirá desativação do estabelecimento e passará por revisão.',
            style: const TextStyle(
              fontSize: 12.5,
              height: 1.35,
              color: Color(0xFF6b7280),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _controller,
            autofocus: true,
            maxLines: 4,
            minLines: 3,
            decoration: InputDecoration(
              hintText: 'Motivo da desativação',
              filled: true,
              fillColor: const Color(0xFFf8f9fb),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () {
                final reason = _controller.text.trim();
                if (reason.isEmpty) return;
                Navigator.of(context).pop(reason);
              },
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFdc2626),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Enviar solicitação'),
            ),
          ),
        ],
      ),
    );
  }
}
