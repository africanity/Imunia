import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'child_selection_screen.dart';
import '../child/child_dashboard_screen.dart';
import '../../core/config/api_config.dart';
import '../../services/settings_service.dart';
import '../../models/system_settings.dart';

class PinLoginScreen extends StatefulWidget {
  const PinLoginScreen({super.key});

  @override
  State<PinLoginScreen> createState() => _PinLoginScreenState();
}

class _PinLoginScreenState extends State<PinLoginScreen>
    with TickerProviderStateMixin {
  final TextEditingController phoneController = TextEditingController();
  final List<TextEditingController> _pinControllers =
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(4, (_) => FocusNode());
  final FocusNode phoneFocus = FocusNode();

  bool isLoading = false;
  String? error;
  bool _phoneHasFocus = false;
  SystemSettings? _settings;

  final storage = const FlutterSecureStorage();

  // Animations
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late AnimationController _logoController;

  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _logoAnimation;

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

  @override
  void initState() {
    super.initState();
    _loadSettings();

    phoneFocus.addListener(() {
      setState(() => _phoneHasFocus = phoneFocus.hasFocus);
    });

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );

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

    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _logoAnimation = Tween<double>(begin: 1.0, end: 1.05).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeInOut),
    );

    _fadeController.forward();
    _slideController.forward();
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
    phoneController.dispose();
    for (var controller in _pinControllers) {
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.dispose();
    }
    phoneFocus.dispose();
    _fadeController.dispose();
    _slideController.dispose();
    _logoController.dispose();
    super.dispose();
  }

  String _getPin() {
    return _pinControllers.map((c) => c.text).join();
  }

  void _clearPin() {
    for (var controller in _pinControllers) {
      controller.clear();
    }
    if (_focusNodes.isNotEmpty) {
      _focusNodes[0].requestFocus();
    }
  }

  void _onPinDigitChanged(int index, String value) {
    if (value.isNotEmpty && index < 3) {
      _focusNodes[index + 1].requestFocus();
    }

    final pin = _getPin();
    if (pin.length == 4) {
      _verifyLogin();
    }
  }


  Future<void> _verifyLogin() async {
    final phone = phoneController.text.trim();
    final pin = _getPin();

    if (phone.isEmpty || pin.length != 4) {
      setState(() => error = "Veuillez remplir tous les champs.");
      return;
    }

    setState(() {
      isLoading = true;
      error = null;
    });

    try {
      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/parent-login");
      final response = await http.post(
        url,
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "phone": phone,
          "pin": pin,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data["success"] == true) {
        final token = data["token"] as String;
        await storage.write(key: 'auth_token', value: token);

        if (data["children"] != null && (data["children"] as List).length > 1) {
          // Plusieurs enfants, rediriger vers la sélection
          if (!mounted) return;
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => ChildSelectionScreen(
                children: List<Map<String, dynamic>>.from(data["children"]),
                token: token,
              ),
            ),
          );
        } else {
          // Un seul enfant, rediriger vers l'interface enfant
          final child = data["child"] as Map<String, dynamic>;
          final childId = child["id"] ?? child["_id"] ?? '';
          await storage.write(key: 'child_id', value: childId.toString());
          await storage.write(key: 'parent_phone', value: phone);

          if (!mounted) return;
          // Naviguer vers l'interface enfant
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => ChildDashboardScreen(
                userData: child,
                childId: childId.toString(),
              ),
            ),
          );
        }
      } else {
        setState(() {
          error = data["message"] ?? "Numéro ou PIN incorrect";
          _clearPin();
        });
      }
    } catch (e) {
      setState(() {
        error = "Erreur de connexion au serveur.";
        _clearPin();
      });
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
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                children: [
                  const SizedBox(height: 30),

                  // Logo animé
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
                      child: _buildLogo(120),
                    ),
                  ),

                  const SizedBox(height: 20),

                  Text(
                    _settings?.appName ?? "Imunia",
                    style: GoogleFonts.poppins(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF0A1A33),
                      letterSpacing: 1,
                    ),
                  ),

                  const SizedBox(height: 8),

                  Text(
                    "Connectez-vous avec votre code PIN",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: const Color(0xFF64748B),
                      fontWeight: FontWeight.w400,
                    ),
                  ),

                  const SizedBox(height: 50),

                  // Card avec champs
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
                        // Champ téléphone
                        _buildAnimatedTextField(
                          controller: phoneController,
                          focusNode: phoneFocus,
                          label: "Numéro de téléphone",
                          hint: "77 123 45 67",
                          icon: Icons.phone_outlined,
                          hasFocus: _phoneHasFocus,
                          keyboardType: TextInputType.phone,
                        ),

                        const SizedBox(height: 32),

                        // Champ PIN
                        Text(
                          "Code PIN",
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF0A1A33),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _buildPinFields(),

                        // Message d'erreur
                        if (error != null) ...[
                          const SizedBox(height: 20),
                          Container(
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
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 30),

                  if (isLoading)
                    const CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF3B760F)),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedTextField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String label,
    required String hint,
    required IconData icon,
    required bool hasFocus,
    TextInputType? keyboardType,
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
            color: hasFocus ? Colors.white : const Color(0xFFF8FAFC),
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
            keyboardType: keyboardType,
            style: GoogleFonts.poppins(
              color: const Color(0xFF0A1A33),
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
            decoration: InputDecoration(
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

  Widget _buildPinFields() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: List.generate(4, (index) {
        return Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _focusNodes[index].hasFocus
                  ? const Color(0xFF3B760F)
                  : Colors.grey[300]!,
              width: 2,
            ),
            boxShadow: _focusNodes[index].hasFocus
                ? [
                    BoxShadow(
                      color: const Color(0xFF3B760F).withOpacity(0.2),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : [],
          ),
          child: TextField(
            controller: _pinControllers[index],
            focusNode: _focusNodes[index],
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            maxLength: 1,
            obscureText: true,
            style: GoogleFonts.poppins(
              fontSize: 24,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF0A1A33),
            ),
            decoration: const InputDecoration(
              border: InputBorder.none,
              counterText: '',
            ),
            onChanged: (value) {
              _onPinDigitChanged(index, value);
            },
            onTap: () {
              if (index > 0 && _pinControllers[index - 1].text.isEmpty) {
                _focusNodes[index - 1].requestFocus();
              }
            },
          ),
        );
      }),
    );
  }
}

