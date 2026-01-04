import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/auth_service.dart';
import '../../services/settings_service.dart';
import '../../models/system_settings.dart';
import '../../core/config/api_config.dart';
import '../onboarding/onboarding_screen.dart';
import '../child/child_dashboard_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  SystemSettings? _settings;

  @override
  void initState() {
    super.initState();

    // Animation d'apparition du logo
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    );

    _animation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    );

    _controller.forward();
    
    // Charger les paramètres système
    _loadSettings();

    // Redirection après 5 secondes avec vérification de connexion
    Timer(const Duration(seconds: 5), () async {
      await _checkAuthAndNavigate();
    });
  }

  /// Charge les paramètres système depuis le serveur
  Future<void> _loadSettings() async {
    try {
      final settings = await SettingsService.getSystemSettings();
      if (mounted) {
        setState(() {
          _settings = settings;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        print('Erreur chargement settings: $e');
      }
    }
  }

  /// Vérifier si l'utilisateur est connecté et naviguer vers la bonne page
  Future<void> _checkAuthAndNavigate() async {
    if (!mounted) return;

    try {
      final isLoggedIn = await AuthService.isLoggedIn();
      
      if (isLoggedIn) {
        // Utilisateur connecté → Restaurer la session automatiquement
        final sessionData = await AuthService.getSessionData();
        
        if (sessionData != null && sessionData['childId'] != null) {
          // Restaurer la session et naviguer directement vers le dashboard
          final childId = sessionData['childId'] as String;
          final childData = sessionData['child'] as Map<String, dynamic>?;
          
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => ChildDashboardScreen(
                  userData: childData ?? {},
                  childId: childId,
                ),
              ),
            );
            return;
          }
        }
      }
      
      // Pas connecté ou session invalide → Aller à l'onboarding
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => OnboardingScreen(settings: _settings),
          ),
        );
      }
    } catch (e) {
      if (kDebugMode) {
        print("Erreur vérification auth: $e");
      }
      // En cas d'erreur, aller à l'onboarding par sécurité
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => OnboardingScreen(settings: _settings),
          ),
        );
      }
    }
  }

  Widget _buildLogo(double size) {
    if (_settings?.logoUrl != null) {
      // Construire l'URL complète du logo
      final logoUrl = _settings!.logoUrl!;
      final fullUrl = logoUrl.startsWith('http')
          ? logoUrl
          : '${ApiConfig.baseUrl}$logoUrl';
      
      return CachedNetworkImage(
        imageUrl: fullUrl,
        width: size,
        height: size,
        fit: BoxFit.contain,
        placeholder: (context, url) => SizedBox(
          width: size,
          height: size,
          child: const CircularProgressIndicator(),
        ),
        errorWidget: (context, url, error) => Image.asset(
          'assets/images/logo_vacxcare.png',
          width: size,
          height: size,
        ),
      );
    }
    return Image.asset(
      'assets/images/logo_vacxcare.png',
      width: size,
      height: size,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Color _getBackgroundColor() {
    if (_settings?.mobileBackgroundColor != null) {
      try {
        final colorStr = _settings!.mobileBackgroundColor!.replaceAll('#', '');
        return Color(int.parse('FF$colorStr', radix: 16));
      } catch (e) {
        return const Color(0xFF0A1A33);
      }
    }
    return const Color(0xFF0A1A33);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _getBackgroundColor(),
      body: Stack(
        children: [
          // LOGO + TITRE remontés
          Align(
            alignment: const Alignment(0, -0.15), // Remonté vers le haut
            child: ScaleTransition(
              scale: _animation,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Logo dans un cercle avec ombre - AGRANDI
                  Container(
                    padding: const EdgeInsets.all(35),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.white.withOpacity(0.2),
                          blurRadius: 40,
                          spreadRadius: 10,
                        ),
                      ],
                    ),
                    child: _buildLogo(140),
                  ),

                  const SizedBox(height: 28),

                  // Titre
                  Text(
                    _settings?.appName ?? "Imunia",
                    style: GoogleFonts.poppins(
                      color: Colors.white,
                      fontSize: 42,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Sous-titre
                  Text(
                    _settings?.appSubtitle ?? "Santé de votre enfant simplifiée",
                    style: GoogleFonts.poppins(
                      color: Colors.white.withOpacity(0.85),
                      fontSize: 16,
                      fontWeight: FontWeight.w400,
                      letterSpacing: 0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),

          // Indicateur de chargement + Texte "Powered by Africanity Group" en bas
          Positioned(
            bottom: 60,
            left: 0,
            right: 0,
            child: Column(
              children: [
                // Indicateur de chargement
                Container(
                  width: 40,
                  height: 40,
                  margin: const EdgeInsets.only(bottom: 20),
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(
                      Colors.white.withOpacity(0.8),
                    ),
                    strokeWidth: 3,
                  ),
                ),

                Text(
                  "Powered by",
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(
                    color: Colors.white.withOpacity(0.7),
                    fontSize: 13,
                    fontWeight: FontWeight.w300,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  "Africanity Group",
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

