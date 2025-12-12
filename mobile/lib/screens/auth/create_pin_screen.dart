import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'vaccine_selection_screen.dart';
import '../child/child_dashboard_screen.dart';
import '../../core/config/api_config.dart';

class CreatePinScreen extends StatefulWidget {
  final String token;
  final Map<String, dynamic> userData;
  final bool isNewParent;
  
  const CreatePinScreen({
    super.key,
    required this.token,
    required this.userData,
    this.isNewParent = false,
  });

  @override
  State<CreatePinScreen> createState() => _CreatePinScreenState();
}

class _CreatePinScreenState extends State<CreatePinScreen> {
  final List<TextEditingController> _pinControllers = 
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(4, (_) => FocusNode());
  
  final List<TextEditingController> _confirmPinControllers = 
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _confirmFocusNodes = List.generate(4, (_) => FocusNode());
  
  bool _isConfirming = false;
  bool _isLoading = false;
  String? _error;

  final storage = const FlutterSecureStorage();

  @override
  void dispose() {
    for (var controller in _pinControllers) {
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.dispose();
    }
    for (var controller in _confirmPinControllers) {
      controller.dispose();
    }
    for (var node in _confirmFocusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  String _getPin() {
    return _pinControllers.map((c) => c.text).join();
  }

  String _getConfirmPin() {
    return _confirmPinControllers.map((c) => c.text).join();
  }

  void _onPinDigitChanged(int index, String value, bool isConfirm) {
    if (value.isNotEmpty && index < 3) {
      if (isConfirm) {
        _confirmFocusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index + 1].requestFocus();
      }
    }

    final controllers = isConfirm ? _confirmPinControllers : _pinControllers;
    final pin = controllers.map((c) => c.text).join();
    
    if (pin.length == 4) {
      if (!_isConfirming && !isConfirm) {
        setState(() {
          _isConfirming = true;
          _error = null;
        });
        Future.delayed(const Duration(milliseconds: 300), () {
          _confirmFocusNodes[0].requestFocus();
        });
      } else if (_isConfirming && isConfirm) {
        _validateAndSavePin();
      }
    }
  }


  Future<void> _validateAndSavePin() async {
    final pin = _getPin();
    final confirmPin = _getConfirmPin();

    if (pin != confirmPin) {
      setState(() {
        _error = "Les codes PIN ne correspondent pas";
        for (var controller in _confirmPinControllers) {
          controller.clear();
        }
        _confirmFocusNodes[0].requestFocus();
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Sauvegarder le token et les données utilisateur
      await storage.write(key: 'auth_token', value: widget.token);
      final childId = widget.userData['id'] ?? widget.userData['_id'];
      if (childId != null) {
        await storage.write(key: 'child_id', value: childId.toString());
      }
      final parentPhone = widget.userData['parentPhone'];
      if (parentPhone != null) {
        await storage.write(key: 'parent_phone', value: parentPhone);
      }

      // Sauvegarder le PIN sur le serveur
      final childIdForApi = widget.userData['id'] ?? widget.userData['_id'];
      final parentPhoneForApi = widget.userData['parentPhone'];
      
      final response = await http.post(
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/parent-pin/save'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: json.encode({
          'childId': childIdForApi,
          'parentPhone': parentPhoneForApi,
          'pin': pin,
        }),
      );

      final responseData = jsonDecode(response.body);
      
      if (response.statusCode != 200 || responseData["success"] != true) {
        throw Exception(responseData["message"] ?? "Erreur lors de la sauvegarde du PIN");
      }

      if (!mounted) return;

      // Réinitialiser l'état de chargement
      setState(() {
        _isLoading = false;
      });

      // Naviguer vers la sélection des vaccins (pour les nouveaux parents)
      if (widget.isNewParent) {
        final childId = widget.userData['id'] ?? widget.userData['_id'] ?? '';
        final birthDateStr = widget.userData['birthDate'];
        DateTime? birthDate;
        
        if (birthDateStr != null) {
          try {
            birthDate = birthDateStr is String 
                ? DateTime.parse(birthDateStr) 
                : birthDateStr as DateTime;
          } catch (e) {
            // Si la date ne peut pas être parsée, utiliser la date actuelle comme fallback
            birthDate = DateTime.now();
          }
        } else {
          birthDate = DateTime.now();
        }
        
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => VaccineSelectionScreen(
              childId: childId.toString(),
              childBirthDate: birthDate!,
              token: widget.token,
              userData: widget.userData,
            ),
          ),
        );
      } else {
        // Pour les parents existants qui changent juste leur PIN, aller directement au dashboard
        final childIdForNavigation = widget.userData['id'] ?? widget.userData['_id'] ?? '';
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => ChildDashboardScreen(
              userData: widget.userData,
              childId: childIdForNavigation.toString(),
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = e.toString().contains("Exception:") 
            ? e.toString().replaceFirst("Exception: ", "")
            : "Erreur lors de la sauvegarde du PIN";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0A1A33)),
          onPressed: () {
            if (_isConfirming) {
              setState(() {
                _isConfirming = false;
                _error = null;
                for (var controller in _confirmPinControllers) {
                  controller.clear();
                }
              });
            } else {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            }
          },
        ),
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.all(24.0),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - 48,
                ),
                child: IntrinsicHeight(
                  child: Column(
                    children: [
                      const SizedBox(height: 20),
                      
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
                      
                      const SizedBox(height: 24),
                      
                      Text(
                        _isConfirming ? "Confirmez votre code PIN" : "Créez votre code PIN",
                        style: GoogleFonts.poppins(
                          fontSize: 24,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF0A1A33),
                        ),
                        textAlign: TextAlign.center,
                      ),
                      
                      const SizedBox(height: 8),
                      
                      Text(
                        _isConfirming 
                            ? "Saisissez à nouveau votre code PIN"
                            : "Ce code vous permettra d'accéder rapidement à votre compte",
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          color: Colors.grey[600],
                        ),
                        textAlign: TextAlign.center,
                      ),
                      
                      const SizedBox(height: 48),
                      
                      // Champs PIN
                      _buildPinFields(
                        _isConfirming ? _confirmPinControllers : _pinControllers,
                        _isConfirming ? _confirmFocusNodes : _focusNodes,
                        _isConfirming,
                      ),
                      
                      const SizedBox(height: 24),
                      
                      if (_error != null)
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.red.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline, color: Colors.red, size: 20),
                              const SizedBox(width: 8),
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
                      
                      const Spacer(),
                      
                      if (_isLoading)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 20),
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0A1A33)),
                          ),
                        ),
                      
                      const SizedBox(height: 20),
                      
                      // Info sécurité
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF3BA3E5).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.info_outline,
                              color: Color(0xFF3BA3E5),
                              size: 24,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                "Mémorisez bien ce code, il vous sera demandé à chaque connexion",
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  color: const Color(0xFF0A1A33),
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
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildPinFields(
    List<TextEditingController> controllers,
    List<FocusNode> focusNodes,
    bool isConfirm,
  ) {
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
              color: focusNodes[index].hasFocus
                  ? const Color(0xFF3BA3E5)
                  : Colors.grey[300]!,
              width: 2,
            ),
            boxShadow: focusNodes[index].hasFocus
                ? [
                    BoxShadow(
                      color: const Color(0xFF3BA3E5).withOpacity(0.2),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : [],
          ),
          child: TextField(
            controller: controllers[index],
            focusNode: focusNodes[index],
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
              _onPinDigitChanged(index, value, isConfirm);
            },
            onTap: () {
              if (index > 0 && controllers[index - 1].text.isEmpty) {
                focusNodes[index - 1].requestFocus();
              }
            },
          ),
        );
      }),
    );
  }
}

