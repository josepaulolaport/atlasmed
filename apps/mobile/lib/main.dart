import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:atlasmed_mobile_app/firebase_options.dart';
import 'package:atlasmed_mobile_app/app.dart';
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

  // Inicializa o Hive (persistência local de sessão e cache)
  await Hive.initFlutter();

  // Configura o armazenamento de cache dos repositórios (usa Hive internamente)
  BaseRepository.storage = await HiveRepositoryCacheStorage.create();

  runApp(const ProviderScope(child: AtlasMedApp()));
}
