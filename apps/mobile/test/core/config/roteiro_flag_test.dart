import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('the roteiro is off unless the build asks for it', () {
    // The beta ships the planning half withheld (spec 0016 §15.8): the agenda
    // and the capture loop stand alone, so a build can offer the diary without
    // the suggestions — no Mapbox Matrix spend, and one question for the pilot
    // instead of two.
    //
    // Defaulting *off* rather than on is the load-bearing part. A flag that
    // defaults on ships the feature to anyone who forgets to pass it, which is
    // the opposite of what withholding it is for. This test runs with no
    // dart-defines, which is exactly that case.
    expect(AppConfig.roteiroEnabled, isFalse);
  });
}
