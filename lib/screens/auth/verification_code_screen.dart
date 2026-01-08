import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'create_pin_screen.dart';
import '../../core/config/api_config.dart';

class VerificationCodeScreen extends StatefulWidget {
  final String registrationId;
  final String parentPhone;
  final String parentName;

  const VerificationCodeScreen({
    super.key,
    required this.registrationId,
    required this.parentPhone,
    required this.parentName,
  });

  @override
  State<VerificationCodeScreen> createState() => _VerificationCodeScreenState();
}

class _VerificationCodeScreenState extends State<VerificationCodeScreen> {
  final TextEditingController _codeController = TextEditingController();
  bool _isLoading = false;
  bool _isResending = false;
  String? _error;
  String? _successMessage;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _resendCode() async {
    setState(() {
      _isResending = true;
      _error = null;
      _successMessage = null;
    });

    try {
      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/resend-verification-code");
      final response = await http.post(
        url,
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "registrationId": widget.registrationId,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data["success"] == true) {
        setState(() {
          _successMessage = "Nouveau code envoyé avec succès";
        });
      } else {
        setState(() {
          _error = data["message"] ?? "Erreur lors du renvoi du code";
        });
      }
    } catch (e) {
      setState(() {
        _error = "Erreur de connexion au serveur";
      });
    } finally {
      setState(() {
        _isResending = false;
      });
    }
  }

  Future<void> _verifyCode() async {
    final code = _codeController.text.trim();

    if (code.isEmpty || code.length != 6) {
      setState(() {
        _error = "Veuillez entrer le code à 6 chiffres";
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Vérifier le code et créer le compte
      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/parent-register");
      final response = await http.post(
        url,
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "registrationId": widget.registrationId,
          "verificationCode": code,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data["success"] == true) {
        // Code vérifié et compte créé, naviguer vers la création du PIN
        if (!mounted) return;
        
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => CreatePinScreen(
              token: data["token"] as String,
              userData: {
                ...Map<String, dynamic>.from(data["child"]),
                "parentPhone": widget.parentPhone,
                "token": data["token"],
              },
              isNewParent: true,
            ),
          ),
        );
      } else {
        setState(() {
          _error = data["message"] ?? "Code de vérification incorrect";
        });
      }
    } catch (e) {
      setState(() {
        _error = "Erreur de connexion au serveur";
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
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
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          "Vérification",
          style: GoogleFonts.poppins(
            color: const Color(0xFF0A1A33),
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 20),

              // Icône de vérification
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF3B760F).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.mark_email_read_outlined,
                  size: 80,
                  color: Color(0xFF3B760F),
                ),
              ),

              const SizedBox(height: 30),

              Text(
                "Vérifiez votre WhatsApp",
                style: GoogleFonts.poppins(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF0A1A33),
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 12),

              Text(
                "Nous vous avons envoyé un code de vérification à 6 chiffres via WhatsApp au numéro ${widget.parentPhone}",
                style: GoogleFonts.poppins(
                  fontSize: 15,
                  color: const Color(0xFF64748B),
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 40),

              // Champ de code
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Code de vérification",
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF0A1A33),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _codeController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF0A1A33),
                      letterSpacing: 8,
                    ),
                    decoration: InputDecoration(
                      hintText: "000000",
                      hintStyle: GoogleFonts.poppins(
                        color: const Color(0xFF94A3B8),
                        fontSize: 28,
                        letterSpacing: 8,
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      counterText: "",
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(
                          color: Color(0xFFE2E8F0),
                          width: 1.5,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(
                          color: Color(0xFFE2E8F0),
                          width: 1.5,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(
                          color: Color(0xFF3B760F),
                          width: 2,
                        ),
                      ),
                    ),
                    onSubmitted: (_) => _verifyCode(),
                  ),
                ],
              ),

              if (_error != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline,
                          color: Colors.red, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _error!,
                          style: GoogleFonts.poppins(
                            color: Colors.red,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              if (_successMessage != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3B760F).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF3B760F).withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline,
                          color: Color(0xFF3B760F), size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _successMessage!,
                          style: GoogleFonts.poppins(
                            color: const Color(0xFF3B760F),
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 30),

              // Bouton de vérification
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _verifyCode,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3B760F),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2.5,
                          ),
                        )
                      : Text(
                          "Vérifier le code",
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),

              const SizedBox(height: 20),

              // Bouton renvoyer le code
              TextButton(
                onPressed: _isResending ? null : _resendCode,
                child: _isResending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF3B760F),
                        ),
                      )
                    : Text(
                        "Renvoyer le code",
                        style: GoogleFonts.poppins(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF3B760F),
                        ),
                      ),
              ),

              const SizedBox(height: 10),

              // Aide
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF0A1A33).withOpacity(0.05),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.help_outline,
                      color: const Color(0xFF0A1A33).withOpacity(0.6),
                      size: 22,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        "Vous n'avez pas reçu le code ?\nVérifiez vos messages WhatsApp ou cliquez sur 'Renvoyer le code'",
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
            ],
          ),
        ),
      ),
    );
  }
}

