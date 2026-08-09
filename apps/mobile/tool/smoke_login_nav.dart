// Local-only smoke against a running driver_main app.
//   dart run tool/smoke_login_nav.dart http://127.0.0.1:PORT/token=/

import 'package:flutter_driver/flutter_driver.dart';

Future<void> main(List<String> args) async {
  if (args.isEmpty) {
    throw StateError('Pass VM service HTTP URL');
  }

  final driver = await FlutterDriver.connect(dartVmServiceUrl: args.first);
  try {
    // Already logged in from prior run? Prefer nav smoke from shell.
    final onLogin = await _exists(driver, find.text('Entrar'), const Duration(seconds: 2));
    if (onLogin) {
      await driver.setTextEntryEmulation(enabled: true);
      final emailField = find.descendant(
        of: find.byType('LoginScreen'),
        matching: find.byType('TextField'),
        firstMatchOnly: true,
      );
      await driver.tap(emailField);
      await driver.enterText('admin@atlasmed.com.br');
      await driver.sendTextInputAction(TextInputAction.next);
      await driver.enterText('Atlasmed@2026');
      await driver.tap(find.text('Entrar'));
    }

    await driver.waitFor(find.text('Desempenho'), timeout: const Duration(seconds: 30));
    print('LOGIN_OK');

    // Drawer navigation (not bottom tabs)
    await _openDrawer(driver);

    await driver.tap(find.text('Explorar'), timeout: const Duration(seconds: 8));
    print('TAB_Explorar');
    await Future<void>.delayed(const Duration(seconds: 3));
    print('EXPLORE_OK');

    await _openDrawer(driver);
    await driver.tap(find.text('Usuários'), timeout: const Duration(seconds: 8));
    print('TAB_Usuarios');
    await Future<void>.delayed(const Duration(seconds: 2));

    await driver.tap(find.text('Convidar'), timeout: const Duration(seconds: 8));
    print('INVITE_OK');
    await Future<void>.delayed(const Duration(seconds: 1));

    print('SMOKE_DONE');
  } finally {
    await driver.close();
  }
}

Future<void> _openDrawer(FlutterDriver driver) async {
  final alreadyOpen = await _exists(
    driver,
    find.byValueKey('atlas-drawer-navigation'),
    const Duration(milliseconds: 500),
  );
  if (alreadyOpen) return;

  // Hamburger is a GestureDetector + Icons.menu_rounded in the AppBar (no tooltip).
  final menuIcon = find.descendant(
    of: find.byType('AppBar'),
    matching: find.byType('Icon'),
    firstMatchOnly: true,
  );
  await driver.tap(menuIcon, timeout: const Duration(seconds: 5));
  await driver.waitFor(
    find.byValueKey('atlas-drawer-navigation'),
    timeout: const Duration(seconds: 5),
  );
  print('DRAWER_OPEN');
}

Future<bool> _exists(
  FlutterDriver driver,
  SerializableFinder finder,
  Duration timeout,
) async {
  try {
    await driver.waitFor(finder, timeout: timeout);
    return true;
  } catch (_) {
    return false;
  }
}
