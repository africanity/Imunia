import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/config/api_config.dart';

class ApiService {
  static String get _baseUrl => ApiConfig.apiBaseUrl;
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  
  // Headers avec authentification
  static Future<Map<String, String>> _getHeaders() async {
    final token = await _storage.read(key: 'auth_token');
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }
  
  // Gestion des erreurs HTTP
  static void _handleHttpError(http.Response response) {
    if (response.statusCode >= 400) {
      // Pour les erreurs 401 (token invalide/expiré), on ne déconnecte pas automatiquement
      // Le token sera vérifié au prochain démarrage de l'app
      if (response.statusCode == 401) {
        try {
          final error = json.decode(response.body);
          throw Exception(error['message'] ?? 'Token invalide ou expiré');
        } catch (e) {
          throw Exception('Token invalide ou expiré');
        }
      }
      
      // Pour les autres erreurs, on lance une exception normale
      try {
        final error = json.decode(response.body);
        throw Exception(error['message'] ?? 'Erreur API: ${response.statusCode}');
      } catch (e) {
        throw Exception('Erreur API: ${response.statusCode}');
      }
    }
  }
  
  // ==================== RENDEZ-VOUS ====================
  
  /// Récupérer les rendez-vous d'un enfant
  static Future<List<Map<String, dynamic>>> getAppointments(String childId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$_baseUrl/mobile/children/$childId/appointments'),
        headers: headers,
      );
      _handleHttpError(response);
      final data = json.decode(response.body);
      // L'API retourne { success: true, total: X, appointments: [...] }
      if (data is Map && data['appointments'] != null) {
        return List<Map<String, dynamic>>.from(data['appointments']);
      }
      return List<Map<String, dynamic>>.from(data);
    } catch (e) {
      print('❌ Erreur getAppointments: $e');
      return [];
    }
  }
  
  // ==================== NOTIFICATIONS ====================
  
  /// Récupérer les notifications d'un enfant
  static Future<List<Map<String, dynamic>>> getNotifications(String childId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$_baseUrl/mobile/children/$childId/notifications'),
        headers: headers,
      );
      _handleHttpError(response);
      final data = json.decode(response.body);
      // L'API retourne { success: true, total: X, notifications: [...] }
      if (data is Map && data['notifications'] != null) {
        return List<Map<String, dynamic>>.from(data['notifications']);
      }
      return List<Map<String, dynamic>>.from(data);
    } catch (e) {
      print('❌ Erreur getNotifications: $e');
      return [];
    }
  }

  /// Marquer toutes les notifications comme lues
  static Future<bool> markAllNotificationsAsRead(String childId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.put(
        Uri.parse('$_baseUrl/mobile/children/$childId/notifications/mark-all-read'),
        headers: headers,
      );
      _handleHttpError(response);
      final data = json.decode(response.body);
      return data['success'] == true;
    } catch (e) {
      print('❌ Erreur markAllNotificationsAsRead: $e');
      return false;
    }
  }

  /// Récupérer le nombre de notifications non lues
  static Future<int> getUnreadNotificationsCount(String childId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$_baseUrl/mobile/children/$childId/notifications/unread-count'),
        headers: headers,
      );
      _handleHttpError(response);
      final data = json.decode(response.body);
      if (data is Map && data['count'] != null) {
        return data['count'] as int;
      }
      return 0;
    } catch (e) {
      print('❌ Erreur getUnreadNotificationsCount: $e');
      return 0;
    }
  }
  
  // ==================== STATISTIQUES ====================
  
  /// Récupérer les statistiques de vaccination d'un enfant
  static Future<Map<String, dynamic>> getVaccinationStats(String childId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$_baseUrl/mobile/children/$childId/dashboard'),
        headers: headers,
      );
      _handleHttpError(response);
      return json.decode(response.body);
    } catch (e) {
      print('❌ Erreur getVaccinationStats: $e');
      return {};
    }
  }
  
  // ==================== CAMPAGNES ====================
  
  /// Récupérer les campagnes de vaccination
  static Future<List<Map<String, dynamic>>> getCampaigns() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$_baseUrl/mobile/campaigns'),
        headers: headers,
      );
      _handleHttpError(response);
      final data = json.decode(response.body);
      // L'API retourne { success: true, total: X, campaigns: [...] }
      if (data is Map && data['campaigns'] != null) {
        return List<Map<String, dynamic>>.from(data['campaigns']);
      }
      return List<Map<String, dynamic>>.from(data);
    } catch (e) {
      print('❌ Erreur getCampaigns: $e');
      return [];
    }
  }
  
  // ==================== CONSEILS ====================
  
  /// Récupérer les conseils de santé
  static Future<List<Map<String, dynamic>>> getHealthTips({String? childId}) async {
    try {
      final headers = await _getHeaders();
      final url = childId != null 
          ? '$_baseUrl/mobile/advice?childId=$childId'
          : '$_baseUrl/mobile/advice';
      final response = await http.get(
        Uri.parse(url),
        headers: headers,
      );
      _handleHttpError(response);
      final data = json.decode(response.body);
      // L'API retourne { success: true, total: X, items: [...] }
      if (data is Map && data['items'] != null) {
        return List<Map<String, dynamic>>.from(data['items']);
      }
      return List<Map<String, dynamic>>.from(data);
    } catch (e) {
      print('❌ Erreur getHealthTips: $e');
      return [];
    }
  }
  
  // ==================== ENFANTS ====================
  
  /// Récupérer les informations d'un enfant
  static Future<Map<String, dynamic>> getChild(String childId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$_baseUrl/mobile/children/$childId/dashboard'),
        headers: headers,
      );
      _handleHttpError(response);
      final data = json.decode(response.body);
      // Retourner les données de l'enfant depuis le dashboard
      if (data is Map && data['child'] != null) {
        return Map<String, dynamic>.from(data['child']);
      }
      return Map<String, dynamic>.from(data);
    } catch (e) {
      print('❌ Erreur getChild: $e');
      return {};
    }
  }
  
  /// Récupérer la liste des enfants du parent
  static Future<List<Map<String, dynamic>>> getParentChildren() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$_baseUrl/mobile/children'),
        headers: headers,
      );
      _handleHttpError(response);
      final data = json.decode(response.body);
      // L'API retourne { success: true, children: [...] }
      if (data is Map && data['children'] != null) {
        return List<Map<String, dynamic>>.from(data['children']);
      }
      return List<Map<String, dynamic>>.from(data);
    } catch (e) {
      print('❌ Erreur getParentChildren: $e');
      return [];
    }
  }
}

