// ═══════════════════════════════════════════════════════════════════
//  Firebase Options — Gerado pelo FlutterFire CLI
// ═══════════════════════════════════════════════════════════════════
//  Execute o comando abaixo para gerar este arquivo automaticamente
//  após criar o projeto Firebase:
//
//    dart pub global activate flutterfire_cli
//    flutterfire configure --project=atlasmed-app --platforms=web
//
//  Isso irá preencher as configurações corretas para cada plataforma.
// ═══════════════════════════════════════════════════════════════════

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions não configurado para $defaultTargetPlatform',
        );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  👇 PREENCHA abaixo após criar o projeto Firebase
  // ═══════════════════════════════════════════════════════════════════

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'PENDENTE',
    appId: 'PENDENTE',
    messagingSenderId: 'PENDENTE',
    projectId: 'atlasmed-app',
    authDomain: 'atlasmed-app.firebaseapp.com',
    storageBucket: 'atlasmed-app.firebasestorage.app',
    measurementId: 'PENDENTE', // Opcional
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'PENDENTE',
    appId: 'PENDENTE',
    messagingSenderId: 'PENDENTE',
    projectId: 'atlasmed-app',
    storageBucket: 'atlasmed-app.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'PENDENTE',
    appId: 'PENDENTE',
    messagingSenderId: 'PENDENTE',
    projectId: 'atlasmed-app',
    storageBucket: 'atlasmed-app.firebasestorage.app',
    iosBundleId: 'com.atlasmed.app',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'PENDENTE',
    appId: 'PENDENTE',
    messagingSenderId: 'PENDENTE',
    projectId: 'atlasmed-app',
    storageBucket: 'atlasmed-app.firebasestorage.app',
    iosBundleId: 'com.atlasmed.app',
  );
}
