import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/config/api_config.dart';
import '../../core/theme/app_colors.dart';

class EditChildProfileScreen extends StatefulWidget {
  final String childId;

  const EditChildProfileScreen({super.key, required this.childId});

  @override
  State<EditChildProfileScreen> createState() => _EditChildProfileScreenState();
}

class _EditChildProfileScreenState extends State<EditChildProfileScreen> {
  final _storage = const FlutterSecureStorage();
  final _formKey = GlobalKey<FormState>();
  
  // Contrôleurs
  final _fatherNameController = TextEditingController();
  final _motherNameController = TextEditingController();
  final _tuteurController = TextEditingController();
  final _phoneController = TextEditingController();
  final _newPhoneController = TextEditingController();
  final _addressController = TextEditingController();
  
  String _responsable = 'PERE';
  String? _originalResponsable;
  bool _isLoading = false;
  bool _isLoadingData = true;
  bool _changingPhone = false;
  bool _shouldChangePhone = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadChildData();
  }

  @override
  void dispose() {
    _fatherNameController.dispose();
    _motherNameController.dispose();
    _tuteurController.dispose();
    _phoneController.dispose();
    _newPhoneController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _loadChildData() async {
    setState(() {
      _isLoadingData = true;
      _error = null;
    });

    try {
      final token = await _storage.read(key: 'auth_token');
      if (token == null) {
        setState(() {
          _error = "Token d'authentification manquant";
          _isLoadingData = false;
        });
        return;
      }

      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/children/${widget.childId}/dashboard");
      final response = await http.get(
        url,
        headers: {
          "Authorization": "Bearer $token",
          "Content-Type": "application/json",
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final child = data['child'] as Map<String, dynamic>? ?? {};
        
        setState(() {
          _fatherNameController.text = child['fatherName'] ?? '';
          _motherNameController.text = child['motherName'] ?? '';
          _tuteurController.text = child['tuteur'] ?? '';
          _phoneController.text = child['parentPhone'] ?? '';
          _addressController.text = child['address'] ?? '';
          _responsable = child['responsable'] ?? 'PERE';
          _originalResponsable = _responsable;
          _isLoadingData = false;
        });
      } else {
        setState(() {
          _error = "Erreur lors du chargement des données";
          _isLoadingData = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = "Erreur de connexion: ${e.toString()}";
        _isLoadingData = false;
      });
    }
  }

  Future<void> _requestPhoneChangeCode() async {
    if (_newPhoneController.text.trim().isEmpty) {
      setState(() {
        _error = "Veuillez entrer un nouveau numéro de téléphone";
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final token = await _storage.read(key: 'auth_token');
      if (token == null) {
        setState(() {
          _error = "Token d'authentification manquant";
          _isLoading = false;
        });
        return;
      }

      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/children/${widget.childId}/request-phone-change-code");
      final response = await http.post(
        url,
        headers: {
          "Authorization": "Bearer $token",
          "Content-Type": "application/json",
        },
        body: jsonEncode({
          "newPhoneParent": _newPhoneController.text.trim(),
        }),
      );

      if (response.statusCode == 200) {
        // Le code a été envoyé, maintenant on doit vérifier
        setState(() {
          _isLoading = false;
        });
        
        // Afficher un dialogue pour entrer le code
        final verificationCode = await _showVerificationCodeDialog();
        
        if (verificationCode != null && verificationCode.isNotEmpty) {
          // Vérifier le code et mettre à jour le profil
          await _verifyAndUpdatePhone(verificationCode);
        }
      } else {
        final errorData = jsonDecode(response.body);
        setState(() {
          _error = errorData['message'] ?? "Erreur lors de l'envoi du code";
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = "Erreur de connexion: ${e.toString()}";
        _isLoading = false;
      });
    }
  }

  Future<void> _saveProfile() async {
    // Validation : au moins un des trois (père, mère, tuteur) doit être rempli
    final fatherName = _fatherNameController.text.trim();
    final motherName = _motherNameController.text.trim();
    final tuteur = _tuteurController.text.trim();
    
    if (fatherName.isEmpty && motherName.isEmpty && tuteur.isEmpty) {
      setState(() {
        _error = "Au moins un des champs (père, mère, tuteur) doit être rempli";
      });
      return;
    }

    // Validation : le responsable doit correspondre à un des champs remplis
    if (_responsable == 'PERE' && fatherName.isEmpty) {
      setState(() {
        _error = "Le responsable est le père, mais le nom du père n'est pas renseigné";
      });
      return;
    }
    if (_responsable == 'MERE' && motherName.isEmpty) {
      setState(() {
        _error = "Le responsable est la mère, mais le nom de la mère n'est pas renseigné";
      });
      return;
    }
    if (_responsable == 'TUTEUR' && tuteur.isEmpty) {
      setState(() {
        _error = "Le responsable est le tuteur, mais le nom du tuteur n'est pas renseigné";
      });
      return;
    }

    // Si le responsable a changé, proposer de changer le numéro
    if (_responsable != _originalResponsable && !_shouldChangePhone) {
      final shouldChange = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Changer le numéro ?'),
          content: Text(
            'Le responsable a changé de ${_getResponsibleLabel(_originalResponsable ?? 'PERE')} à ${_getResponsibleLabel(_responsable)}. '
            'Souhaitez-vous changer le numéro de téléphone associé ?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Non'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Oui'),
            ),
          ],
        ),
      );

      if (shouldChange == true) {
        setState(() {
          _shouldChangePhone = true;
          _changingPhone = true;
        });
        await _requestPhoneChangeCode();
        return; // Attendre la vérification du code
      }
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final token = await _storage.read(key: 'auth_token');
      if (token == null) {
        setState(() {
          _error = "Token d'authentification manquant";
          _isLoading = false;
        });
        return;
      }

      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/children/${widget.childId}/profile");
      final response = await http.put(
        url,
        headers: {
          "Authorization": "Bearer $token",
          "Content-Type": "application/json",
        },
        body: jsonEncode({
          "fatherName": fatherName.isEmpty ? null : fatherName,
          "motherName": motherName.isEmpty ? null : motherName,
          "tuteur": tuteur.isEmpty ? null : tuteur,
          "responsable": _responsable,
          "phoneParent": _phoneController.text.trim(),
          "newPhoneParent": null,
          "changePhone": false,
          "address": _addressController.text.trim(),
        }),
      );

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Profil mis à jour avec succès'),
              backgroundColor: AppColors.success,
            ),
          );
          Navigator.pop(context, true);
        }
      } else {
        final errorData = jsonDecode(response.body);
        setState(() {
          _error = errorData['message'] ?? "Erreur lors de la mise à jour";
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = "Erreur de connexion: ${e.toString()}";
        _isLoading = false;
      });
    }
  }

  Future<String?> _showVerificationCodeDialog() async {
    final codeController = TextEditingController();
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Code de vérification'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Entrez le code à 6 chiffres envoyé par WhatsApp'),
            const SizedBox(height: 16),
            TextField(
              controller: codeController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, letterSpacing: 8),
              decoration: const InputDecoration(
                hintText: '000000',
                counterText: '',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () {
              if (codeController.text.length == 6) {
                Navigator.pop(context, codeController.text);
              }
            },
            child: const Text('Vérifier'),
          ),
        ],
      ),
    );
  }

  Future<void> _verifyAndUpdatePhone(String verificationCode) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final token = await _storage.read(key: 'auth_token');
      if (token == null) {
        setState(() {
          _error = "Token d'authentification manquant";
          _isLoading = false;
        });
        return;
      }

      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/children/${widget.childId}/profile");
      final response = await http.put(
        url,
        headers: {
          "Authorization": "Bearer $token",
          "Content-Type": "application/json",
        },
        body: jsonEncode({
          "fatherName": _fatherNameController.text.trim().isEmpty ? null : _fatherNameController.text.trim(),
          "motherName": _motherNameController.text.trim().isEmpty ? null : _motherNameController.text.trim(),
          "tuteur": _tuteurController.text.trim().isEmpty ? null : _tuteurController.text.trim(),
          "responsable": _responsable,
          "phoneParent": _phoneController.text.trim(),
          "newPhoneParent": _newPhoneController.text.trim(),
          "changePhone": true,
          "verificationCode": verificationCode,
          "address": _addressController.text.trim(),
        }),
      );

      if (response.statusCode == 200) {
        setState(() {
          _phoneController.text = _newPhoneController.text.trim();
          _changingPhone = false;
          _shouldChangePhone = false;
          _newPhoneController.clear();
          _isLoading = false;
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Numéro de téléphone mis à jour avec succès'),
              backgroundColor: AppColors.success,
            ),
          );
        }
      } else {
        final errorData = jsonDecode(response.body);
        setState(() {
          _error = errorData['message'] ?? "Erreur lors de la vérification du code";
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = "Erreur de connexion: ${e.toString()}";
        _isLoading = false;
      });
    }
  }

  String _getResponsibleLabel(String responsable) {
    switch (responsable) {
      case 'PERE':
        return 'Père';
      case 'MERE':
        return 'Mère';
      case 'TUTEUR':
        return 'Tuteur';
      default:
        return responsable;
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
          "Modifier le profil",
          style: GoogleFonts.poppins(
            color: const Color(0xFF0A1A33),
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: _isLoadingData
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red[50],
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red[200]!),
                        ),
                        child: Text(
                          _error!,
                          style: GoogleFonts.poppins(
                            color: Colors.red[800],
                            fontSize: 14,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    _buildTextField(
                      controller: _fatherNameController,
                      label: "Nom du père (optionnel)",
                      hint: "Ex: Amadou Diallo",
                      icon: Icons.person_outline,
                    ),
                    const SizedBox(height: 20),
                    _buildTextField(
                      controller: _motherNameController,
                      label: "Nom de la mère (optionnel)",
                      hint: "Ex: Aissatou Diallo",
                      icon: Icons.person_outline,
                    ),
                    const SizedBox(height: 20),
                    _buildTextField(
                      controller: _tuteurController,
                      label: "Nom du tuteur (optionnel)",
                      hint: "Ex: Tonton Mamadou",
                      icon: Icons.person_outline,
                    ),
                    const SizedBox(height: 20),
                    DropdownButtonFormField<String>(
                      value: _responsable,
                      decoration: InputDecoration(
                        labelText: "Responsable de l'enfant *",
                        hintText: "Celui dont on va mettre le numéro",
                        prefixIcon: const Icon(Icons.person),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        filled: true,
                        fillColor: Colors.grey[50],
                      ),
                      items: const [
                        DropdownMenuItem(value: 'PERE', child: Text('Père')),
                        DropdownMenuItem(value: 'MERE', child: Text('Mère')),
                        DropdownMenuItem(value: 'TUTEUR', child: Text('Tuteur')),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setState(() {
                            _responsable = value;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 20),
                    _buildTextField(
                      controller: _phoneController,
                      label: "Numéro de téléphone actuel",
                      hint: "77 123 45 67",
                      icon: Icons.phone_outlined,
                      keyboardType: TextInputType.phone,
                      enabled: false,
                    ),
                    if (_changingPhone) ...[
                      const SizedBox(height: 20),
                      _buildTextField(
                        controller: _newPhoneController,
                        label: "Nouveau numéro de téléphone",
                        hint: "77 123 45 67",
                        icon: Icons.phone_outlined,
                        keyboardType: TextInputType.phone,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _isLoading ? null : _requestPhoneChangeCode,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF3B760F),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : Text(
                                "Envoyer le code de vérification",
                                style: GoogleFonts.poppins(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ] else ...[
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: () {
                          setState(() {
                            _changingPhone = true;
                          });
                        },
                        icon: const Icon(Icons.edit),
                        label: const Text("Changer le numéro"),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    _buildTextField(
                      controller: _addressController,
                      label: "Adresse de l'enfant",
                      hint: "Ex: Rue 123, Dakar",
                      icon: Icons.location_on_outlined,
                    ),
                    const SizedBox(height: 32),
                    ElevatedButton(
                      onPressed: _isLoading ? null : _saveProfile,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF3B760F),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : Text(
                              "Enregistrer les modifications",
                              style: GoogleFonts.poppins(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
    bool enabled = true,
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
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          enabled: enabled,
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
            prefixIcon: Icon(icon, color: const Color(0xFF64748B)),
            filled: true,
            fillColor: enabled ? const Color(0xFFF8FAFC) : Colors.grey[200],
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
                color: Color(0xFF0A1A33),
                width: 2,
              ),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: Color(0xFFE2E8F0),
                width: 1.5,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
