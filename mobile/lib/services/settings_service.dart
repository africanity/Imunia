import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/system_settings.dart';
import '../core/config/api_config.dart';

class SettingsService {
  static String get baseUrl => ApiConfig.apiBaseUrl;

  static Future<SystemSettings?> getSystemSettings() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/systemSettings'),
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['settings'] != null) {
          return SystemSettings.fromJson(data['settings']);
        }
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('Erreur chargement settings: $e');
      }
      return null;
    }
  }
}

