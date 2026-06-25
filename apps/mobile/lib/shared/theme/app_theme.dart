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
}

class AppTheme {
  static ThemeData get light => ThemeData(
        useMaterial3: true,
        fontFamily: 'Inter',
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.navyDeep,
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: AppColors.background,
      );
}
