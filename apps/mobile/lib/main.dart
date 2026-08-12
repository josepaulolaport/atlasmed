import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:device_preview/device_preview.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:atlasmed_mobile_app/firebase_options.dart';
import 'package:atlasmed_mobile_app/app.dart';
import 'package:atlasmed_mobile_app/core/observability/error_handlers.dart';
import 'package:atlasmed_mobile_app/repository/base_repository.dart';
import 'package:atlasmed_mobile_app/repository/external/hive_repository_cache_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  // Inicializa o Firebase (configuração gerada pelo FlutterFire CLI)
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Captura erros não tratados (síncronos e assíncronos) antes que virem
  // apenas ruído no console.
  await installErrorHandlers();

  // Inicializa o Hive (persistência local de sessão e cache)
  await Hive.initFlutter();

  // Configura o armazenamento de cache dos repositórios (usa Hive internamente)
  BaseRepository.storage = await HiveRepositoryCacheStorage.create();

  // No web o app roda sempre dentro do Device Preview (frame + toolbar de
  // dispositivo) para simular o visual mobile no navegador. Em plataformas
  // nativas o Device Preview fica desativado.
  final app = const ProviderScope(child: AtlasMedApp());
  runApp(kIsWeb ? DevicePreview(enabled: true, builder: (_) => app) : app);
}
