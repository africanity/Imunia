import 'dart:io';
import 'package:flutter/foundation.dart';

/// Configuration centralisée de l'API
class ApiConfig {
  /// URL de base du backend
  /// 
  /// - Sur Android (émulateur) : utilise 10.0.2.2 pour accéder à localhost de la machine hôte
  /// - Sur iOS (simulateur) : utilise localhost
  /// - Sur Web : utilise localhost
  /// - Sur Android (appareil physique) : utilise l'IP locale de la machine (à configurer)
  static String get baseUrl {
    if (kIsWeb) {
      return 'http://localhost:5050';
    }
    
    if (Platform.isAndroid) {
      // Sur l'émulateur Android, 10.0.2.2 est l'alias de localhost de la machine hôte
      // Pour un appareil physique, vous devrez utiliser l'IP locale de votre machine
      return 'http://10.0.2.2:5050';
    }
    
    // iOS et autres plateformes
    return 'http://localhost:5050';
  }
  
  /// URL de base de l'API (avec /api)
  static String get apiBaseUrl => '$baseUrl/api';
  
  /// URL pour Socket.io
  static String get socketUrl => baseUrl;
}

