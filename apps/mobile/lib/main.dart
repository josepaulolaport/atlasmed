import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'firebase_options.dart';
import 'app.dart';
import 'repository/base_repository.dart';
import 'repository/external/hive_repository_cache_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicializa o Firebase (configuração gerada pelo FlutterFire CLI)
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Inicializa o Hive (persistência local de sessão e cache)
  await Hive.initFlutter();

  // Configura o armazenamento de cache dos repositórios (usa Hive internamente)
  BaseRepository.storage = await HiveRepositoryCacheStorage.create();

  runApp(const ProviderScope(child: AtlasMedApp()));
}
