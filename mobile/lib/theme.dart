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

/// App surfaces: the website's black and yellow on a light, card-based mobile layout.
class AppColors {
  static const black = Color(0xFF111111);
  static const yellow = Tw.pahangYellow;
  static const yellowSoft = Color(0xFFFFF6C2);
  static const background = Color(0xFFF3F4F6);
  static const line = Color(0xFFE8EAEE);
  static const text = Tw.slate900;
  static const muted = Tw.slate500;
  static const faint = Tw.slate400;
}

ThemeData buildTheme() {
  const r12 = BorderRadius.all(Radius.circular(12));
  final base = ThemeData(
    useMaterial3: true,
    fontFamily: 'Inter',
    colorScheme: ColorScheme.fromSeed(
      seedColor: Tw.pahangYellow,
      primary: AppColors.black,
      onPrimary: Tw.pahangYellow,
      secondary: Tw.pahangYellow,
      onSecondary: AppColors.black,
      surface: Colors.white,
      error: Tw.red600,
    ),
    scaffoldBackgroundColor: AppColors.background,
  );
  final buttonShape = WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: r12));
  const buttonText = WidgetStatePropertyAll(TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w600));
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: AppColors.text, displayColor: AppColors.text),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: AppColors.text,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: TextStyle(fontFamily: 'Inter', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.text),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.black),
    filledButtonTheme: FilledButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.disabled) ? Tw.slate300 : AppColors.black),
        foregroundColor: const WidgetStatePropertyAll(Tw.pahangYellow),
        minimumSize: const WidgetStatePropertyAll(Size(64, 48)),
        shape: buttonShape,
        textStyle: buttonText,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: ButtonStyle(
        foregroundColor: const WidgetStatePropertyAll(AppColors.text),
        side: const WidgetStatePropertyAll(BorderSide(color: Tw.slate300)),
        minimumSize: const WidgetStatePropertyAll(Size(64, 48)),
        shape: buttonShape,
        textStyle: buttonText,
      ),
    ),
    textButtonTheme: const TextButtonThemeData(
      style: ButtonStyle(foregroundColor: WidgetStatePropertyAll(AppColors.text), textStyle: buttonText),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: Tw.pahangYellow,
      foregroundColor: AppColors.black,
      elevation: 2,
      extendedTextStyle: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 15),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      hintStyle: TextStyle(color: Tw.slate400, fontSize: 15),
      labelStyle: TextStyle(color: Tw.slate500),
      border: OutlineInputBorder(borderRadius: r12, borderSide: BorderSide(color: AppColors.line)),
      enabledBorder: OutlineInputBorder(borderRadius: r12, borderSide: BorderSide(color: AppColors.line)),
      focusedBorder: OutlineInputBorder(borderRadius: r12, borderSide: BorderSide(color: AppColors.black, width: 1.5)),
      errorBorder: OutlineInputBorder(borderRadius: r12, borderSide: BorderSide(color: Tw.rose500)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      selectedColor: AppColors.black,
      side: const BorderSide(color: AppColors.line),
      labelStyle: const TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.text),
      secondaryLabelStyle: const TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, color: Tw.pahangYellow),
      checkmarkColor: Tw.pahangYellow,
      shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.black : Colors.white),
        foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Tw.pahangYellow : AppColors.text),
        side: const WidgetStatePropertyAll(BorderSide(color: AppColors.line)),
        textStyle: buttonText,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      indicatorColor: Tw.pahangYellow,
      elevation: 3,
      height: 70,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: s.contains(WidgetState.selected) ? AppColors.text : AppColors.muted,
          )),
      iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(color: s.contains(WidgetState.selected) ? AppColors.black : AppColors.muted)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    ),
    dialogTheme: const DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(20))),
    ),
    listTileTheme: const ListTileThemeData(iconColor: AppColors.text),
    popupMenuTheme: const PopupMenuThemeData(
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: r12),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.line, space: 1, thickness: 1),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.black,
      contentTextStyle: TextStyle(fontFamily: 'Inter', color: Colors.white, fontSize: 14),
      shape: RoundedRectangleBorder(borderRadius: r12),
    ),
  );
}
