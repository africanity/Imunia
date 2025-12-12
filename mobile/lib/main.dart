import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'core/theme/app_theme.dart';
import 'screens/splash/splash_screen.dart';
import 'screens/auth/pin_login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Gestion globale des erreurs pour éviter les crashes
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
  };
  
  // Gestion des erreurs asynchrones non capturées
  PlatformDispatcher.instance.onError = (error, stack) {
    return true;
  };
  
  await initializeDateFormatting('fr_FR', null);
  Intl.defaultLocale = 'fr_FR';
  runApp(const VacxCareApp());
}

class VacxCareApp extends StatelessWidget {
  const VacxCareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'VacxCare',
      theme: AppTheme.theme,
      
      // Configuration locale
      locale: const Locale('fr', 'FR'),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('fr', 'FR'),
        Locale('en', 'US'),
      ],

      // Page de démarrage
      home: const SplashScreen(),
      
      // Routes
      routes: {
        '/pin-login': (context) => const PinLoginScreen(),
      },
    );
  }
}
