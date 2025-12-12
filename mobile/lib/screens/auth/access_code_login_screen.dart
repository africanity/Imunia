import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'create_pin_screen.dart';
import '../../core/config/api_config.dart';

class AccessCodeLoginScreen extends StatefulWidget {
  const AccessCodeLoginScreen({super.key});

  @override
  State<AccessCodeLoginScreen> createState() => _AccessCodeLoginScreenState();
}

class _AccessCodeLoginScreenState extends State<AccessCodeLoginScreen> with TickerProviderStateMixin {
  final TextEditingController phoneController = TextEditingController();
  final TextEditingController idController = TextEditingController();
  final FocusNode phoneFocus = FocusNode();
  final FocusNode idFocus = FocusNode();
  
  bool isLoading = false;
  String? error;
  bool _phoneHasFocus = false;
  bool _idHasFocus = false;

  final storage = const FlutterSecureStorage();

  // Animations
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late AnimationController _logoController;
  late AnimationController _buttonController;
  
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _logoAnimation;

  @override
  void initState() {
    super.initState();
    
    // Focus listeners
    phoneFocus.addListener(() {
      setState(() => _phoneHasFocus = phoneFocus.hasFocus);
    });
    idFocus.addListener(() {
      setState(() => _idHasFocus = idFocus.hasFocus);
    });

    // Fade animation
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );

    // Slide animation
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutCubic,
    ));

    // Logo breathing animation
    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _logoAnimation = Tween<double>(begin: 1.0, end: 1.05).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeInOut),
    );

    // Button animation
    _buttonController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );

    // Start animations
    _fadeController.forward();
    _slideController.forward();
  }

  @override
  void dispose() {
    phoneController.dispose();
    idController.dispose();
    phoneFocus.dispose();
    idFocus.dispose();
    _fadeController.dispose();
    _slideController.dispose();
    _logoController.dispose();
    _buttonController.dispose();
    super.dispose();
  }

  Future<void> _verifyChildAndNavigate() async {
    final phone = phoneController.text.trim();
    final code = idController.text.trim();

    if (phone.isEmpty || code.isEmpty) {
      setState(() => error = "Veuillez saisir le numéro et le code d'accès reçus par SMS.");
      return;
    }

    setState(() {
      isLoading = true;
      error = null;
    });

    try {
      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/verify-access-code");
      final response = await http.post(
        url,
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "phone": phone,
          "accessCode": code,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data["success"] == true) {
        final token = data["token"] as String;
        final hasPin = data["hasPin"] as bool? ?? false;

        await storage.write(key: 'auth_token', value: token);
        final childId = data["child"]["id"] as String;
        await storage.write(key: 'child_id', value: childId);
        await storage.write(key: 'parent_phone', value: phone);

        if (!mounted) return;

        if (hasPin) {
          // Parent a déjà un PIN, rediriger vers le dashboard
          // TODO: Naviguer vers le dashboard
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Connexion réussie ! Redirection..."),
            ),
          );
        } else {
          // Nouveau parent, créer un PIN puis demander les vaccins déjà faits
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => CreatePinScreen(
                token: token,
                userData: {
                  ...Map<String, dynamic>.from(data["child"]),
                  "parentPhone": phone,
                  "token": token,
                },
                isNewParent: true, // Première connexion, demander les vaccins
              ),
            ),
          );
        }
      } else {
        setState(() {
          error = data["message"] ?? "Code d'accès invalide";
        });
      }
    } catch (e) {
      setState(() => error = "Erreur de connexion au serveur.");
    } finally {
      setState(() => isLoading = false);
    }
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
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight - 40,
                    ),
                    child: Column(
                      children: [
                        const SizedBox(height: 20),

                        // Logo animé avec effet de respiration - AGRANDI
                        ScaleTransition(
                    scale: _logoAnimation,
                    child: Container(
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
                      child: Image.asset(
                        "assets/images/logo_vacxcare.png",
                        width: 120,
                        height: 120,
                      ),
                    ),
                  ),

                        const SizedBox(height: 20),

                        // Titre IMUNIA
                        Text(
                    "Imunia",
                    style: GoogleFonts.poppins(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF0A1A33),
                      letterSpacing: 1,
                    ),
                  ),

                        const SizedBox(height: 8),

                        Text(
                          "Bienvenue sur votre carnet de santé digital",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: const Color(0xFF64748B),
                      fontWeight: FontWeight.w400,
                    ),
                  ),

                        const SizedBox(height: 50),

                        // Card bleue avec transparence
                        Container(
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0A1A33).withOpacity(0.05),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: const Color(0xFF0A1A33).withOpacity(0.15),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0A1A33).withOpacity(0.08),
                          blurRadius: 30,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Champ téléphone avec animation
                        _buildAnimatedTextField(
                          controller: phoneController,
                          focusNode: phoneFocus,
                          label: "Numéro de téléphone",
                          hint: "77 123 45 67",
                          icon: Icons.phone_outlined,
                          hasFocus: _phoneHasFocus,
                          keyboardType: TextInputType.phone,
                        ),

                        const SizedBox(height: 24),

                        // Champ Code d'accès avec animation
                        _buildAnimatedTextField(
                          controller: idController,
                          focusNode: idFocus,
                          label: "Code d'accès reçu par SMS",
                          hint: "Entrez le code à 6 chiffres",
                          icon: Icons.key_outlined,
                          hasFocus: _idHasFocus,
                          maxLength: 6,
                        ),

                        const SizedBox(height: 32),

                        // Bouton avec animation
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          width: double.infinity,
                          height: 56,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            gradient: const LinearGradient(
                              colors: [
                                Color(0xFF3B760F),
                                Color(0xFF2E7D32),
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF3B760F).withOpacity(0.4),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: isLoading ? null : () {
                                _buttonController.forward().then((_) {
                                  _buttonController.reverse();
                                  _verifyChildAndNavigate();
                                });
                              },
                              borderRadius: BorderRadius.circular(16),
                              child: Center(
                                child: isLoading
                                    ? const SizedBox(
                                        width: 24,
                                        height: 24,
                                        child: CircularProgressIndicator(
                                          color: Colors.white,
                                          strokeWidth: 2.5,
                                        ),
                                      )
                                    : Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Text(
                                            "Continuer",
                                            style: GoogleFonts.poppins(
                                              fontSize: 17,
                                              fontWeight: FontWeight.w600,
                                              color: Colors.white,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          const Icon(
                                            Icons.arrow_forward_rounded,
                                            color: Colors.white,
                                            size: 20,
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                          ),
                        ),

                        // Message d'erreur animé
                        if (error != null) ...[
                          const SizedBox(height: 20),
                          TweenAnimationBuilder<double>(
                            tween: Tween(begin: 0.0, end: 1.0),
                            duration: const Duration(milliseconds: 400),
                            builder: (context, value, child) {
                              return Transform.translate(
                                offset: Offset(0, 10 * (1 - value)),
                                child: Opacity(
                                  opacity: value,
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Colors.red.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: Colors.red.withOpacity(0.3),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          Icons.error_outline,
                                          color: Colors.red[300],
                                          size: 20,
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            error!,
                                            style: GoogleFonts.poppins(
                                              color: Colors.red[200],
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ],
                      ],
                    ),
                        ),

                        const SizedBox(height: 20),

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
                                  "Vous n'avez pas reçu le code d'accès ?\nContactez votre agent de santé.",
                                  style: GoogleFonts.poppins(
                                    fontSize: 13,
                                    color: const Color(0xFF64748B),
                                    height: 1.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  // Widget TextField animé personnalisé
  Widget _buildAnimatedTextField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String label,
    required String hint,
    required IconData icon,
    required bool hasFocus,
    TextInputType? keyboardType,
    int? maxLength,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF0A1A33),
          ),
        ),
        const SizedBox(height: 8),
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
          decoration: BoxDecoration(
            color: hasFocus
                ? Colors.white
                : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: hasFocus
                  ? const Color(0xFF0A1A33)
                  : const Color(0xFFE2E8F0),
              width: hasFocus ? 2 : 1.5,
            ),
            boxShadow: hasFocus
                ? [
                    BoxShadow(
                      color: const Color(0xFF0A1A33).withOpacity(0.15),
                      blurRadius: 15,
                      spreadRadius: 2,
                    ),
                  ]
                : [],
          ),
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            keyboardType: keyboardType ?? TextInputType.text,
            maxLength: maxLength,
            style: GoogleFonts.poppins(
              color: const Color(0xFF0A1A33),
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
            decoration: InputDecoration(
              counterText: maxLength != null ? "" : null,
              hintText: hint,
              hintStyle: GoogleFonts.poppins(
                color: const Color(0xFF94A3B8),
                fontSize: 14,
              ),
              prefixIcon: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                child: Icon(
                  icon,
                  color: hasFocus
                      ? const Color(0xFF0A1A33)
                      : const Color(0xFF64748B),
                  size: 22,
                ),
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 16,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

