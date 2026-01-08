import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import '../core/config/api_config.dart';

class AuthService {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static Future<bool> isLoggedIn() async {
    try {
      final token = await _storage.read(key: 'auth_token');
      if (token == null || token.isEmpty) {
        return false;
      }
      // Vérifier la validité du token en faisant un appel API
      return await _validateToken(token);
    } catch (e) {
      return false;
    }
  }

  /// Vérifie la validité du token en faisant un appel API
  static Future<bool> _validateToken(String token) async {
    try {
      final childId = await _storage.read(key: 'child_id');
      if (childId == null || childId.isEmpty) {
        return false;
      }

      final response = await http.get(
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/children/$childId/dashboard'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      // Si le token est valide (200 ou 403 mais pas 401), on considère qu'on est connecté
      // 401 = token invalide/expiré
      // 403 = accès refusé mais token valide
      return response.statusCode == 200 || response.statusCode == 403;
    } catch (e) {
      return false;
    }
  }

  static Future<Map<String, dynamic>?> getUserData() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userDataJson = prefs.getString('user_data');
      if (userDataJson != null) {
        return json.decode(userDataJson) as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Récupère les informations nécessaires pour restaurer la session
  static Future<Map<String, dynamic>?> getSessionData() async {
    try {
      final token = await _storage.read(key: 'auth_token');
      final childId = await _storage.read(key: 'child_id');
      final parentPhone = await _storage.read(key: 'parent_phone');

      if (token == null || childId == null) {
        return null;
      }

      // Vérifier la validité du token et récupérer les données de l'enfant
      final response = await http.get(
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/children/$childId/dashboard'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final childData = data['child'] as Map<String, dynamic>?;
        
        if (childData != null) {
          return {
            'token': token,
            'childId': childId,
            'parentPhone': parentPhone ?? childData['parentPhone'],
            'child': childData,
          };
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}

