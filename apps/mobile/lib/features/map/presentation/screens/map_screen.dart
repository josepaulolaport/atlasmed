import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/providers/map_provider.dart';
import 'package:atlasmed_mobile_app/features/map/presentation/widgets/territory_map_widget.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class MapScreen extends ConsumerWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final token = AppConfig.mapboxAccessToken;
    if (token.isEmpty) {
      return const _MapPage(
        child: _MapMessage(
          icon: Icons.key_off_outlined,
          title: 'Mapa indisponível',
          message: 'A configuração do mapa não foi encontrada.',
        ),
      );
    }

    final data = ref.watch(mapDataProvider);
    return _MapPage(
      child: data.when(
        loading: () => const _MapMessage(
          icon: Icons.map_outlined,
          title: 'Carregando mapa',
          message: 'Buscando sua localização e as clínicas do território…',
          loading: true,
        ),
        error: (error, _) => _MapMessage(
          icon: Icons.location_off_outlined,
          title: 'Não foi possível abrir o mapa',
          message: _messageFor(error),
          actionLabel: 'Tentar novamente',
          onAction: () => ref.invalidate(mapDataProvider),
        ),
        data: (mapData) {
          if (mapData.territory == null) {
            return const _MapMessage(
              icon: Icons.map_outlined,
              title: 'Sem território atribuído',
              message:
                  'Quando houver um território atribuído, as clínicas serão exibidas aqui.',
            );
          }
          return TerritoryMapWidget(data: mapData, accessToken: token);
        },
      ),
    );
  }

  String _messageFor(Object error) {
    if (error is UnimplementedError) {
      return 'O mapa ainda não está conectado aos serviços de localização e território.';
    }
    return 'Verifique a permissão de localização, o GPS e sua conexão para tentar novamente.';
  }
}

class _MapPage extends StatelessWidget {
  final Widget child;

  const _MapPage({required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FB),
      body: SafeArea(
        child: Column(
          children: [
            const AtlasTopBar(page: 'Mapa'),
            Expanded(child: child),
          ],
        ),
      ),
    );
  }
}

class _MapMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final bool loading;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _MapMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.loading = false,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (loading)
              const SizedBox(
                width: 32,
                height: 32,
                child: CircularProgressIndicator(strokeWidth: 3),
              )
            else
              Icon(icon, size: 42, color: const Color(0xFF6B7280)),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
            ),
            if (actionLabel != null) ...[
              const SizedBox(height: 20),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
