import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'pin_login_screen.dart';
import 'access_code_login_screen.dart';
import 'parent_registration_screen.dart';
import '../../services/settings_service.dart';
import '../../models/system_settings.dart';
import '../../core/config/api_config.dart';

/// Écran de choix entre Se connecter avec accès ou Créer un compte
class AuthOptionScreen extends StatefulWidget {
  const AuthOptionScreen({super.key});

  @override
  State<AuthOptionScreen> createState() => _AuthOptionScreenState();
}

class _AuthOptionScreenState extends State<AuthOptionScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  SystemSettings? _settings;

  @override
  void initState() {
    super.initState();
    _loadSettings();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    ));

    _controller.forward();
  }

  Future<void> _loadSettings() async {
    try {
      final settings = await SettingsService.getSystemSettings();
      if (mounted) {
        setState(() {
          _settings = settings;
        });
      }
    } catch (e) {
      // Ignore errors, use default
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
          "assets/images/logo_vacxcare.png",
          width: size,
          height: size,
        ),
      );
    }
    return Image.asset(
      "assets/images/logo_vacxcare.png",
      width: size,
      height: size,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0A1A33)),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
        ),
      ),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SlideTransition(
            position: _slideAnimation,
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    children: [
                      const SizedBox(height: 24),

                      // Logo
                      Container(
                        padding: const EdgeInsets.all(25),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF0A1A33).withOpacity(0.15),
                              blurRadius: 30,
                              spreadRadius: 5,
                            ),
                          ],
                        ),
                        child: _buildLogo(100),
                      ),

                      const SizedBox(height: 28),

                      // Titre
                      Text(
                        "Bienvenue sur ${_settings?.appName ?? "Imunia"}",
                        style: GoogleFonts.poppins(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0A1A33),
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: 12),

                      Text(
                        "Gérez facilement le carnet de santé de votre enfant",
                        style: GoogleFonts.poppins(
                          fontSize: 15,
                          color: const Color(0xFF64748B),
                          fontWeight: FontWeight.w400,
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: 40),

                      // Bouton Se connecter (avec PIN)
                      _buildOptionButton(
                        context: context,
                        title: "Se connecter",
                        subtitle: "Connectez-vous avec votre numéro et votre code PIN",
                        icon: Icons.lock_outline,
                        gradient: const LinearGradient(
                          colors: [Color(0xFF3B760F), Color(0xFF2E7D32)],
                        ),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const PinLoginScreen(),
                            ),
                          );
                        },
                      ),

                      const SizedBox(height: 20),

                      // Bouton Se connecter avec code d'accès (première connexion)
                      _buildOptionButton(
                        context: context,
                        title: "Se connecter avec un code d'accès",
                        subtitle: "Première connexion ? Utilisez le code reçu par SMS",
                        icon: Icons.vpn_key_rounded,
                        gradient: const LinearGradient(
                          colors: [Color(0xFF1E88E5), Color(0xFF1565C0)],
                        ),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const AccessCodeLoginScreen(),
                            ),
                          );
                        },
                      ),

                      const SizedBox(height: 20),

                      // Bouton Créer un compte
                      _buildOptionButton(
                        context: context,
                        title: "Créer un nouveau compte",
                        subtitle: "Enregistrez votre enfant dans l'application",
                        icon: Icons.person_add_rounded,
                        gradient: const LinearGradient(
                          colors: [Color(0xFF0A1A33), Color(0xFF1E3A5F)],
                        ),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const ParentRegistrationScreen(),
                            ),
                          );
                        },
                      ),

                      const SizedBox(height: 28),

                      // Message d'aide
                      Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0A1A33).withOpacity(0.05),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: const Color(0xFF0A1A33).withOpacity(0.1),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.info_outline,
                                  color: const Color(0xFF0A1A33).withOpacity(0.6),
                                  size: 22,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    "Besoin d'aide ? Contactez votre agent de santé",
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 16),
                        ],
                      ),
                    );
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOptionButton({
    required BuildContext context,
    required String title,
    required String subtitle,
    required IconData icon,
    required Gradient gradient,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: gradient,
        boxShadow: [
          BoxShadow(
            color: gradient.colors.first.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    icon,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          color: Colors.white.withOpacity(0.8),
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios,
                  color: Colors.white,
                  size: 18,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

