import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'pin_login_screen.dart';
import 'vaccine_selection_screen.dart';

class WelcomeScreen extends StatelessWidget {
  final Map<String, dynamic> userData;
  
  const WelcomeScreen({
    super.key,
    required this.userData,
  });

  @override
  Widget build(BuildContext context) {
    final storage = const FlutterSecureStorage();
    
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
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Logo
              Container(
                padding: const EdgeInsets.all(20),
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
                  width: 80,
                  height: 80,
                ),
              ),
              
              const SizedBox(height: 40),
              
              // Icône de succès
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF3B760F).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle,
                  size: 80,
                  color: Color(0xFF3B760F),
                ),
              ),
              
              const SizedBox(height: 32),
              
              Text(
                "Bienvenue !",
                style: GoogleFonts.poppins(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF0A1A33),
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: 12),
              
              Text(
                "Votre compte a été créé avec succès",
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  color: Colors.grey[600],
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: 40),
              
              // Informations de l'enfant
              if (userData['name'] != null || userData['firstName'] != null)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFFE2E8F0),
                      width: 1,
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.child_care,
                            color: Color(0xFF3B760F),
                            size: 24,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              userData['name'] ?? 
                              "${userData['firstName'] ?? ''} ${userData['lastName'] ?? ''}".trim(),
                              style: GoogleFonts.poppins(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF0A1A33),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              
              const Spacer(),
              
              // Bouton continuer
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: () async {
                    // Naviguer vers l'écran de sélection de vaccins
                    if (context.mounted) {
                      final childId = userData['id'] ?? userData['_id'];
                      final birthDateStr = userData['birthDate'];
                      final token = userData['token'];
                      
                      if (childId != null && birthDateStr != null && token != null) {
                        final birthDate = DateTime.parse(birthDateStr);
                        
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (_) => VaccineSelectionScreen(
                              childId: childId.toString(),
                              childBirthDate: birthDate,
                              token: token.toString(),
                              userData: userData,
                            ),
                          ),
                        );
                      } else {
                        // Si les données ne sont pas disponibles, aller à la connexion
                        await storage.delete(key: 'auth_token');
                        if (context.mounted) {
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const PinLoginScreen(),
                            ),
                          );
                        }
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3B760F),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    "Continuer",
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

