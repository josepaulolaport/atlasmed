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
    apiKey: 'AIzaSyCqG2IoR2MVkP6n6P6UuEjTF_EI8u2v8jo',
    appId: '1:213092006493:web:d9f92e66973ff862c36bb4',
    messagingSenderId: '213092006493',
    projectId: 'atlasmed-app',
    authDomain: 'atlasmed-app.firebaseapp.com',
    storageBucket: 'atlasmed-app.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBjzGOceiwDTHOoz5yvvlxTrhWlKNl0AGY',
    appId: '1:213092006493:android:8f2a3db45910dea2c36bb4',
    messagingSenderId: '213092006493',
    projectId: 'atlasmed-app',
    storageBucket: 'atlasmed-app.firebasestorage.app',
  );
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyB7ksJEhprh0Pm4xsZuoKqo1iTbxpK1wYU',
    appId: '1:213092006493:ios:b836b99e0104d2e4c36bb4',
    messagingSenderId: '213092006493',
    projectId: 'atlasmed-app',
    storageBucket: 'atlasmed-app.firebasestorage.app',
    iosBundleId: 'br.com.atlasmed.app',
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
