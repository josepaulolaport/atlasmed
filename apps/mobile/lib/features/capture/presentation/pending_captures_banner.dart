import 'package:atlasmed_mobile_app/features/capture/presentation/capture_queue_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Says how many captures are still waiting for signal.
///
/// A queue nobody can see is indistinguishable from work that was silently
/// lost, and a rep who cannot tell the difference will stop trusting the
/// button. Invisible when there is nothing waiting — the common case must not
/// carry a permanent reminder that offline exists.
class PendingCapturesBanner extends ConsumerWidget {
  const PendingCapturesBanner({super.key, this.rounded = false});

  /// Rounded and inset, for sitting inside a card rather than spanning a screen.
  final bool rounded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(captureQueueProvider);
    if (queue.pending == 0) return const SizedBox.shrink();

    final label = queue.pending == 1
        ? '1 registro aguardando envio'
        : '${queue.pending} registros aguardando envio';

    return Container(
      key: const Key('pending-captures-banner'),
      margin: rounded
          ? const EdgeInsets.fromLTRB(12, 0, 12, 8)
          : EdgeInsets.zero,
      decoration: BoxDecoration(
        color: AppColors.amber.withValues(alpha: 0.12),
        borderRadius: rounded ? BorderRadius.circular(10) : null,
      ),
      padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, size: 16, color: AppColors.amber),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 12.5, color: AppColors.gray800),
            ),
          ),
          TextButton(
            // The queue drains on its own whenever something else succeeds;
            // this is for the rep who has just walked back into signal and
            // would rather not wait to find out.
            onPressed: () => ref.read(captureQueueProvider).drain(),
            child: const Text('Enviar agora'),
          ),
        ],
      ),
    );
  }
}
