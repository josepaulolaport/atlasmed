import 'package:flutter/material.dart';

class AppColors {
  // Brand
  static const navyDeep = Color(0xFF0a2f7f);
  static const navyBright = Color(0xFF1e40af);
  static const blueAccent = Color(0xFF3b82f6);

  // Status
  static const green = Color(0xFF16a373);
  static const amber = Color(0xFFc6861b);
  static const red = Color(0xFFb84545);

  // Neutrals
  static const gray900 = Color(0xFF0f1729);
  static const gray700 = Color(0xFF374151);
  static const gray500 = Color(0xFF6b7280);
  static const gray400 = Color(0xFF9ca3af);
  static const gray300 = Color(0xFFd1d5db);
  static const gray100 = Color(0xFFf3f4f6);
  static const background = Color(0xFFf7f8fb);
  static const cardBg = Color(0xFFffffff);

  // Auth backdrop
  static const backdropStart = Color(0xFF0a2f7f);
  static const backdropMid = Color(0xFF1e40af);
  static const backdropEnd = Color(0xFF3b82f6);
  // Extended neutrals
  static const gray200 = Color(0xFFE5E7EB);
  static const gray600 = Color(0xFF4B5563);
  static const gray800 = Color(0xFF1F2937);
  static const gray950 = Color(0xFF111827);

  // Surface backgrounds
  static const surfaceSecondary = Color(0xFFEEF0F3);
  static const surfaceTertiary = Color(0xFFF8F9FB);

  // Extended status
  static const error = Color(0xFFDC2626);
  static const blue600 = Color(0xFF2563EB);
  static const green600 = Color(0xFF059669);

  // Tinted backgrounds
  static const blue50 = Color(0xFFEEF2FF);
  static const red50 = Color(0xFFFDE8E8);
  static const red100 = Color(0xFFFECACA);
  static const amber50 = Color(0xFFFEF3D5);
  static const green50 = Color(0xFFE6F7F0);

  // Blue-50 variant (also high frequency)
  static const blueLight = Color(0xFFEEF4FF);
  // Status & accent extended palette
  static const blueDark = Color(0xFF1D4ED8);
  static const blueDarker = Color(0xFF1E3A8A);
  static const purple = Color(0xFF7C3AED);
  static const pink = Color(0xFFBE185D);
  static const orange = Color(0xFF9A3412);
  static const amberDark = Color(0xFFB45309);
  static const rose = Color(0xFFE11D48);
  static const redDark = Color(0xFFB91C1C);
  static const greenDark = Color(0xFF1F9254);
  static const blue100 = Color(0xFFDBEAFE);
}

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',

    /// Brand navy as the primary, not the seed's interpretation of it.
    ///
    /// `fromSeed` derives a muted, violet-leaning primary from `navyDeep`, and
    /// that colour is what every unstyled Material control picks up: the
    /// confirm button in each dialog, `TextButton` labels, checkboxes,
    /// progress indicators, text selection. Screens that cared said
    /// `AppColors.navyBright` by hand, so the app has been split between its
    /// own blue and a mauve that appears wherever nobody overrode it.
    colorScheme:
        ColorScheme.fromSeed(
          seedColor: AppColors.navyDeep,
          brightness: Brightness.light,
        ).copyWith(
          primary: AppColors.navyBright,
          onPrimary: Colors.white,
          error: AppColors.error,
        ),
    scaffoldBackgroundColor: AppColors.background,

    /// The house app bar, for every pushed screen that does not ask for
    /// something else.
    ///
    /// There was no default at all, so a screen that wrote `AppBar(title: ...)`
    /// and nothing more inherited Material 3's: a 22px title and a
    /// `surfaceTint` that washes the bar mauve as content scrolls under it.
    /// Nothing else in the app does that, and the five screens that set no
    /// colours were the only ones doing it — visibly a different product from
    /// the row of screens either side of them.
    ///
    /// Flat on the page background rather than white, which is what most bars
    /// here already set by hand. The ones that deliberately differ — the navy
    /// contact header, the black image viewers — still say so and still win.
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      surfaceTintColor: Colors.transparent,
      foregroundColor: AppColors.gray900,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: 'Inter',
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: AppColors.gray900,
      ),
    ),

    /// The house dialog, for the same reason the app bar above exists.
    ///
    /// Every `AlertDialog` in the app — discard a draft, cancel an
    /// appointment, delete a note, confirm an unassignment — inherited
    /// Material 3's elevated `surfaceTint`, which washes the sheet mauve and
    /// tints the confirm button to match. Beside the navy the rest of the app
    /// paints, they read as a different product interrupting it.
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.cardBg,
      surfaceTintColor: Colors.transparent,
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      titleTextStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: AppColors.gray900,
      ),
      contentTextStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        height: 1.4,
        color: AppColors.gray700,
      ),
    ),
  );
}

extension ColorX on Color {
  Color createSecondary() {
    final hsl = HSLColor.fromColor(this);

    const hueShift = -7.107505070993938;
    const saturationTowardsMax = 1.0;
    const lightnessTowardsWhite = 0.9442622950819672;

    final hue = (hsl.hue + hueShift + 360) % 360;

    final saturation =
        hsl.saturation + (1 - hsl.saturation) * saturationTowardsMax;

    final lightness =
        hsl.lightness + (1 - hsl.lightness) * lightnessTowardsWhite;

    return HSLColor.fromAHSL(
      hsl.alpha,
      hue,
      saturation.clamp(0.0, 1.0),
      lightness.clamp(0.0, 1.0),
    ).toColor();
  }
}

extension ColorFilterX on ColorFilter {
  static ColorFilter grayscale() {
    return ColorFilter.matrix(<double>[
      0.2126,
      0.7152,
      0.0722,
      0,
      0,
      0.2126,
      0.7152,
      0.0722,
      0,
      0,
      0.2126,
      0.7152,
      0.0722,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ]);
  }
}
