import 'package:flutter_driver/driver_extension.dart';

import 'main.dart' as app;

/// Local smoke entrypoint for Dart MCP / flutter_driver.
/// Not a product surface — do not ship.
void main() {
  enableFlutterDriverExtension();
  app.main();
}
