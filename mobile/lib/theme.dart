import 'package:flutter/material.dart';

/// Colours from the website (frontend/src/styles.css and the Tailwind palette
/// its templates use), so the app reads as the same system.
class Tw {
  static const pahangBlack = Color(0xFF000000);
  static const pahangYellow = Color(0xFFFADA00);

  static const slate50 = Color(0xFFF8FAFC);
  static const slate100 = Color(0xFFF1F5F9);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate300 = Color(0xFFCBD5E1);
  static const slate400 = Color(0xFF94A3B8);
  static const slate500 = Color(0xFF64748B);
  static const slate600 = Color(0xFF475569);
  static const slate700 = Color(0xFF334155);
  static const slate800 = Color(0xFF1E293B);
  static const slate900 = Color(0xFF0F172A);

  static const gray50 = Color(0xFFF9FAFB);
  static const gray100 = Color(0xFFF3F4F6);
  static const gray200 = Color(0xFFE5E7EB);
  static const gray300 = Color(0xFFD1D5DB);
  static const gray400 = Color(0xFF9CA3AF);
  static const gray500 = Color(0xFF6B7280);
  static const gray600 = Color(0xFF4B5563);
  static const gray700 = Color(0xFF374151);
  static const gray900 = Color(0xFF111827);

  static const emerald50 = Color(0xFFECFDF5);
  static const emerald200 = Color(0xFFA7F3D0);
  static const emerald500 = Color(0xFF10B981);
  static const emerald600 = Color(0xFF059669);
  static const emerald700 = Color(0xFF047857);

  static const rose50 = Color(0xFFFFF1F2);
  static const rose200 = Color(0xFFFECDD3);
  static const rose300 = Color(0xFFFDA4AF);
  static const rose500 = Color(0xFFF43F5E);
  static const rose600 = Color(0xFFE11D48);
  static const rose700 = Color(0xFFBE123C);
  static const rose800 = Color(0xFF9F1239);

  static const red50 = Color(0xFFFEF2F2);
  static const red100 = Color(0xFFFEE2E2);
  static const red200 = Color(0xFFFECACA);
  static const red600 = Color(0xFFDC2626);
  static const red700 = Color(0xFFB91C1C);

  static const amber50 = Color(0xFFFFFBEB);
  static const amber200 = Color(0xFFFDE68A);
  static const amber300 = Color(0xFFFCD34D);
  static const amber600 = Color(0xFFD97706);
  static const amber700 = Color(0xFFB45309);
  static const amber800 = Color(0xFF92400E);
  static const amber900 = Color(0xFF78350F);

  static const orange50 = Color(0xFFFFF7ED);
  static const orange200 = Color(0xFFFED7AA);
  static const orange600 = Color(0xFFEA580C);
  static const orange700 = Color(0xFFC2410C);

  static const yellow50 = Color(0xFFFEFCE8);
  static const yellow100 = Color(0xFFFEF9C3);
  static const yellow600 = Color(0xFFCA8A04);
  static const yellow700 = Color(0xFFA16207);
  static const yellow800 = Color(0xFF854D0E);

  static const green100 = Color(0xFFDCFCE7);
  static const green600 = Color(0xFF16A34A);
  static const green700 = Color(0xFF15803D);

  static const blue50 = Color(0xFFEFF6FF);
  static const blue100 = Color(0xFFDBEAFE);
  static const blue200 = Color(0xFFBFDBFE);
  static const blue600 = Color(0xFF2563EB);
  static const blue700 = Color(0xFF1D4ED8);

  static const purple50 = Color(0xFFFAF5FF);
  static const purple100 = Color(0xFFF3E8FF);
  static const purple200 = Color(0xFFE9D5FF);
  static const purple600 = Color(0xFF9333EA);
  static const purple700 = Color(0xFF7E22CE);

  static const sky500 = Color(0xFF0EA5E9);
  static const sky600 = Color(0xFF0284C7);

  /// Tailwind `shadow-sm`.
  static const shadowSm = [BoxShadow(color: Color(0x0D000000), blurRadius: 2, offset: Offset(0, 1))];
}

ThemeData buildTheme() {
  const radius = BorderRadius.all(Radius.circular(8));
  final base = ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    colorScheme: ColorScheme.fromSeed(
      seedColor: Tw.pahangYellow,
      primary: Tw.pahangBlack,
      onPrimary: Tw.pahangYellow,
      secondary: Tw.pahangYellow,
      onSecondary: Tw.pahangBlack,
      surface: Colors.white,
      error: Tw.red600,
    ),
    scaffoldBackgroundColor: Tw.slate100,
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: Tw.gray900, displayColor: Tw.slate900),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Tw.slate900,
      surfaceTintColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      shape: Border(bottom: BorderSide(color: Tw.slate200)),
      iconTheme: IconThemeData(color: Tw.slate600),
      titleTextStyle: TextStyle(fontFamily: 'Inter', fontSize: 20, fontWeight: FontWeight.w700, color: Tw.slate900),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: Tw.pahangYellow),
    inputDecorationTheme: const InputDecorationTheme(
      isDense: true,
      filled: true,
      fillColor: Colors.white,
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      hintStyle: TextStyle(color: Tw.gray400, fontSize: 14),
      border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: Tw.gray300)),
      enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: Tw.gray300)),
      focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: Tw.pahangYellow, width: 2)),
      errorBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: Tw.rose500)),
    ),
    dialogTheme: const DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(16))),
    ),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: Colors.white, surfaceTintColor: Colors.white),
    dividerTheme: const DividerThemeData(color: Tw.slate100, space: 1),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
