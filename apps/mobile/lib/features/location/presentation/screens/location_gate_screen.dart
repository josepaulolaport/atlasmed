import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/app_logo.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/blue_backdrop.dart';
import 'package:atlasmed_mobile_app/features/auth/presentation/widgets/primary_button.dart';
import 'package:atlasmed_mobile_app/features/location/data/location_service.dart';
import 'package:atlasmed_mobile_app/features/location/presentation/providers/location_session_provider.dart';

/// Full-screen hard gate — no skip. Authenticated users stay here until
/// location permission + services yield a usable fix.
class LocationGateScreen extends ConsumerStatefulWidget {
  const LocationGateScreen({super.key});

  @override
  ConsumerState<LocationGateScreen> createState() => _LocationGateScreenState();
}

class _LocationGateScreenState extends ConsumerState<LocationGateScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(locationSessionProvider.notifier).ensureLocation();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(locationSessionProvider.notifier).ensureLocation();
    }
  }

  String _headline(LocationFailure? failure) {
    return switch (failure) {
      LocationFailure.serviceDisabled => 'Ative a localização do aparelho',
      LocationFailure.deniedForever => 'Permita o acesso à localização',
      LocationFailure.denied => 'Precisamos da sua localização',
      LocationFailure.unavailable => 'Não foi possível obter sua localização',
      null => 'Precisamos da sua localização',
    };
  }

  String _body(LocationFailure? failure) {
    return switch (failure) {
      LocationFailure.serviceDisabled =>
        'O GPS ou os serviços de localização estão desligados. Ative-os nas configurações do sistema para continuar.',
      LocationFailure.deniedForever =>
        'O acesso à localização foi negado. Abra as configurações do app, permita “Durante o uso” e tente novamente.',
      LocationFailure.denied =>
        'O AtlasMed usa sua posição para organizar clínicas e médicos por distância. Sem localização o app não pode continuar.',
      LocationFailure.unavailable =>
        'Tente novamente em um local com sinal de GPS, ou verifique as configurações de localização.',
      null =>
        'O AtlasMed usa sua posição para organizar clínicas e médicos por distância. Sem localização o app não pode continuar.',
    };
  }

  bool _shouldOpenSettings(LocationFailure? failure) {
    return failure == LocationFailure.deniedForever ||
        failure == LocationFailure.serviceDisabled;
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(locationSessionProvider);
    final checking =
        session.phase == LocationSessionPhase.checking ||
        session.phase == LocationSessionPhase.unknown;
    final failure = session.failure;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        body: Stack(
          children: [
            const BlueBackdrop(),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Column(
                  children: [
                    const SizedBox(height: 40),
                    const AppLogo(size: 72),
                    const Spacer(),
                    Icon(
                      Icons.location_on_rounded,
                      size: 64,
                      color: Colors.white.withValues(alpha: 0.95),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      _headline(failure),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _body(failure),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 15,
                        height: 1.45,
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                    ),
                    const Spacer(),
                    PrimaryButton(
                      label: checking
                          ? 'Obtendo localização…'
                          : _shouldOpenSettings(failure)
                          ? 'Abrir configurações'
                          : 'Ativar localização',
                      loading: checking,
                      onPressed: checking
                          ? null
                          : () async {
                              if (_shouldOpenSettings(failure)) {
                                await ref
                                    .read(locationSessionProvider.notifier)
                                    .openSystemSettings();
                                return;
                              }
                              await ref
                                  .read(locationSessionProvider.notifier)
                                  .ensureLocation();
                            },
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: checking
                          ? null
                          : () => ref
                                .read(locationSessionProvider.notifier)
                                .ensureLocation(),
                      child: Text(
                        'Tentar novamente',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
