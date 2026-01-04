import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:intl/intl.dart';
import '../../core/widgets/basic_date_picker.dart';
import 'verification_code_screen.dart';
import '../../core/config/api_config.dart';

class ParentRegistrationScreen extends StatefulWidget {
  const ParentRegistrationScreen({super.key});

  @override
  State<ParentRegistrationScreen> createState() =>
      _ParentRegistrationScreenState();
}

class _ParentRegistrationScreenState extends State<ParentRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _pageController = PageController();
  int _currentPage = 0;

  // Contrôleurs parent
  final _parentPhoneController = TextEditingController();
  final _fatherNameController = TextEditingController();
  final _motherNameController = TextEditingController();

  // Contrôleurs enfant
  final _childFirstNameController = TextEditingController();
  final _childLastNameController = TextEditingController();
  DateTime? _childBirthDate;
  String _childGender = 'M';
  final _birthPlaceController = TextEditingController();

  // Contrôleur adresse
  final _addressController = TextEditingController();

  // Région et HealthCenter
  String? _selectedRegionId;
  List<Map<String, dynamic>> _regions = [];
  bool _loadingRegions = false;
  String? _selectedHealthCenterId;
  List<Map<String, dynamic>> _healthCenters = [];
  bool _loadingHealthCenters = false;

  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRegions();
  }

  @override
  void dispose() {
    _parentPhoneController.dispose();
    _fatherNameController.dispose();
    _motherNameController.dispose();
    _childFirstNameController.dispose();
    _childLastNameController.dispose();
    _birthPlaceController.dispose();
    _addressController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadRegions() async {
    setState(() {
      _loadingRegions = true;
    });

    try {
      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/regions");
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final regions = data['items'] ?? data;
        setState(() {
          _regions = List<Map<String, dynamic>>.from(regions);
          _loadingRegions = false;
        });
      } else {
        setState(() {
          _loadingRegions = false;
        });
      }
    } catch (e) {
      setState(() {
        _loadingRegions = false;
      });
    }
  }

  Future<void> _loadHealthCenters({String? regionId}) async {
    setState(() {
      _loadingHealthCenters = true;
      _healthCenters = [];
      _selectedHealthCenterId = null;
    });

    try {
      final url = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/health-centers${regionId != null ? '?regionId=$regionId' : ''}");
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final centers = data['items'] ?? data;
        setState(() {
          _healthCenters = List<Map<String, dynamic>>.from(centers);
          if (_healthCenters.isNotEmpty && _selectedHealthCenterId == null) {
            _selectedHealthCenterId = _healthCenters[0]['id'];
          }
          _loadingHealthCenters = false;
        });
      } else {
        setState(() {
          _loadingHealthCenters = false;
        });
      }
    } catch (e) {
      setState(() {
        _loadingHealthCenters = false;
      });
    }
  }

  Future<void> _selectBirthDate() async {
    final date = await BasicDatePicker.show(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365)),
      firstDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      lastDate: DateTime.now(),
      title: 'Date de naissance',
    );

    if (date != null) {
      setState(() {
        _childBirthDate = date;
      });
    }
  }

  String? _registrationId;

  Future<void> _submitRegistration() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_childBirthDate == null) {
      setState(() {
        _error = "Veuillez sélectionner la date de naissance de l'enfant";
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Toujours régénérer le code (même si on revient en arrière)
      final requestUrl = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/request-verification-code");
      final requestResponse = await http.post(
        requestUrl,
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          // Informations parent
          "parentPhone": _parentPhoneController.text.trim(),
          
          // Informations enfant
          "childFirstName": _childFirstNameController.text.trim(),
          "childLastName": _childLastNameController.text.trim(),
          "childBirthDate": _childBirthDate!.toIso8601String(),
          "childGender": _childGender,
          "birthPlace": _birthPlaceController.text.trim(),
          
          // Informations parents
          "fatherName": _fatherNameController.text.trim(),
          "motherName": _motherNameController.text.trim(),
          
          // Informations adresse
          "address": _addressController.text.trim(),
          
          // HealthCenter (peut être null si aucune région sélectionnée)
          "healthCenterId": _selectedHealthCenterId,
        }),
      );

      final requestData = jsonDecode(requestResponse.body);

      if (requestResponse.statusCode == 200 && requestData["success"] == true) {
        // Code envoyé, afficher l'écran de vérification
        _registrationId = requestData["registrationId"] as String;
        if (!mounted) return;
        
        // Naviguer vers l'écran de vérification du code
        final verificationResult = await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => VerificationCodeScreen(
              registrationId: _registrationId!,
              parentPhone: _parentPhoneController.text.trim(),
              parentName: _fatherNameController.text.trim().isNotEmpty 
                  ? _fatherNameController.text.trim() 
                  : (_motherNameController.text.trim().isNotEmpty 
                      ? _motherNameController.text.trim() 
                      : "Parent"),
            ),
          ),
        );

        // Le compte est créé dans VerificationCodeScreen, on ne fait rien ici
        if (verificationResult == true) {
          // Le compte est créé, on reste sur cette page (la navigation est gérée dans VerificationCodeScreen)
          if (mounted) {
            Navigator.pop(context);
          }
        } else {
          setState(() {
            _isLoading = false;
          });
        }
      } else {
        setState(() {
          _error = requestData["message"] ?? "Erreur lors de l'envoi du code";
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = "Erreur de connexion au serveur";
        _isLoading = false;
      });
    }
  }

  void _nextPage() {
    if (_currentPage < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _submitRegistration();
    }
  }

  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
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
          onPressed: _currentPage > 0 ? _previousPage : () => Navigator.pop(context),
        ),
        title: Text(
          "Créer un compte",
          style: GoogleFonts.poppins(
            color: const Color(0xFF0A1A33),
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: Form(
        key: _formKey,
        child: Column(
          children: [
            // Indicateur de progression
            _buildProgressIndicator(),

            // Pages
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                },
                children: [
                  _buildParentInfoPage(),
                  _buildChildInfoPage(),
                  _buildAddressInfoPage(),
                ],
              ),
            ),

            // Message d'erreur
            if (_error != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 20),
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

            // Bouton suivant/envoyer
            Padding(
              padding: const EdgeInsets.all(24),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _nextPage,
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
                          _currentPage < 2 ? "Suivant" : "Créer le compte",
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: List.generate(3, (index) {
          return Expanded(
            child: Container(
              height: 4,
              margin: EdgeInsets.only(right: index < 2 ? 8 : 0),
              decoration: BoxDecoration(
                color: index <= _currentPage
                    ? const Color(0xFF3B760F)
                    : const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildParentInfoPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Vos informations",
            style: GoogleFonts.poppins(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0A1A33),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "Étape 1/3 - Informations des parents",
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 32),
          _buildTextField(
            controller: _fatherNameController,
            label: "Nom du père",
            hint: "Ex: Amadou Diallo",
            icon: Icons.person_outline,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return "Veuillez entrer le nom du père";
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          _buildTextField(
            controller: _motherNameController,
            label: "Nom de la mère",
            hint: "Ex: Aissatou Diallo",
            icon: Icons.person_outline,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return "Veuillez entrer le nom de la mère";
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          _buildTextField(
            controller: _parentPhoneController,
            label: "Numéro de téléphone",
            hint: "77 123 45 67",
            icon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return "Veuillez entrer votre numéro de téléphone";
              }
              if (value.length < 9) {
                return "Numéro de téléphone invalide";
              }
              return null;
            },
          ),
        ],
      ),
    );
  }

  Widget _buildChildInfoPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Informations de l'enfant",
            style: GoogleFonts.poppins(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0A1A33),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "Étape 2/3 - Informations de l'enfant",
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 32),
          _buildTextField(
            controller: _childFirstNameController,
            label: "Prénom de l'enfant",
            hint: "Ex: Fatou",
            icon: Icons.child_care,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return "Veuillez entrer le prénom de l'enfant";
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          _buildTextField(
            controller: _childLastNameController,
            label: "Nom de famille de l'enfant",
            hint: "Ex: Diallo",
            icon: Icons.family_restroom,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return "Veuillez entrer le nom de famille de l'enfant";
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          // Date de naissance
          InkWell(
            onTap: _selectBirthDate,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: const Color(0xFFE2E8F0),
                  width: 1.5,
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.calendar_today_outlined,
                    color: Color(0xFF64748B),
                    size: 22,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Date de naissance",
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: const Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _childBirthDate != null
                              ? DateFormat('dd/MM/yyyy').format(_childBirthDate!)
                              : "Sélectionner la date",
                          style: GoogleFonts.poppins(
                            fontSize: 15,
                            color: _childBirthDate != null
                                ? const Color(0xFF0A1A33)
                                : const Color(0xFF94A3B8),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          _buildTextField(
            controller: _birthPlaceController,
            label: "Lieu de naissance",
            hint: "Ex: Hôpital Principal, Dakar",
            icon: Icons.location_on_outlined,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return "Veuillez entrer le lieu de naissance";
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          // Genre
          Text(
            "Genre",
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF0A1A33),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildGenderOption('M', 'Garçon', Icons.boy),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildGenderOption('F', 'Fille', Icons.girl),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAddressInfoPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Informations complémentaires",
            style: GoogleFonts.poppins(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF0A1A33),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "Étape 3/3 - Adresse et centre de santé",
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 32),
          _buildTextField(
            controller: _addressController,
            label: "Adresse de domicile",
            hint: "Ex: Quartier Médina, Dakar",
            icon: Icons.home_outlined,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return "Veuillez entrer l'adresse";
              }
              return null;
            },
          ),
          const SizedBox(height: 20),
          // Région
          Text(
            "Région",
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF0A1A33),
            ),
          ),
          const SizedBox(height: 8),
          _loadingRegions
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16.0),
                    child: CircularProgressIndicator(),
                  ),
                )
              : _regions.isEmpty
                  ? Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.orange.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.orange.withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 20),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              "Aucune région disponible",
                              style: GoogleFonts.poppins(
                                fontSize: 13,
                                color: Colors.orange[800],
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  : Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: const Color(0xFFE2E8F0),
                          width: 1.5,
                        ),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _selectedRegionId,
                          isExpanded: true,
                          hint: Text(
                            "Sélectionnez une région",
                            style: GoogleFonts.poppins(
                              color: const Color(0xFF94A3B8),
                              fontSize: 15,
                            ),
                          ),
                          icon: const Icon(Icons.arrow_drop_down, color: Color(0xFF64748B)),
                          style: GoogleFonts.poppins(
                            color: const Color(0xFF0A1A33),
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                          ),
                          items: _regions.map((region) {
                            return DropdownMenuItem<String>(
                              value: region['id'],
                              child: Text(region['name'] ?? 'Région inconnue'),
                            );
                          }).toList(),
                          onChanged: (value) {
                            setState(() {
                              _selectedRegionId = value;
                              _selectedHealthCenterId = null;
                            });
                            if (value != null) {
                              _loadHealthCenters(regionId: value);
                            } else {
                              _loadHealthCenters();
                            }
                          },
                        ),
                      ),
                    ),
          const SizedBox(height: 20),
          // HealthCenter
          Text(
            "Centre de santé",
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF0A1A33),
            ),
          ),
          const SizedBox(height: 8),
          _selectedRegionId == null
              ? Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: Color(0xFF64748B), size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          "Veuillez d'abord sélectionner une région",
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              : _loadingHealthCenters
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(16.0),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  : _healthCenters.isEmpty
                      ? Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.orange.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.orange.withOpacity(0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 20),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  "Aucun centre de santé disponible dans cette région. Un centre sera assigné automatiquement.",
                                  style: GoogleFonts.poppins(
                                    fontSize: 13,
                                    color: Colors.orange[800],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )
                      : Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: const Color(0xFFE2E8F0),
                              width: 1.5,
                            ),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _selectedHealthCenterId,
                              isExpanded: true,
                              icon: const Icon(Icons.arrow_drop_down, color: Color(0xFF64748B)),
                              style: GoogleFonts.poppins(
                                color: const Color(0xFF0A1A33),
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                              ),
                              items: _healthCenters.map((center) {
                                return DropdownMenuItem<String>(
                                  value: center['id'],
                                  child: Text(center['name'] ?? 'Centre inconnu'),
                                );
                              }).toList(),
                              onChanged: (value) {
                                setState(() {
                                  _selectedHealthCenterId = value;
                                });
                              },
                            ),
                          ),
                        ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F9FF),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBAE6FD)),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.info_outline,
                  color: Color(0xFF0369A1),
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    "Votre enfant sera lié à un centre de santé par un agent lors de sa première consultation.",
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      color: const Color(0xFF0369A1),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
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
          validator: validator,
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
            fillColor: const Color(0xFFF8FAFC),
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
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: Colors.red,
                width: 1.5,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGenderOption(String value, String label, IconData icon) {
    final isSelected = _childGender == value;
    return InkWell(
      onTap: () {
        setState(() {
          _childGender = value;
        });
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF3B760F).withOpacity(0.1)
              : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF3B760F)
                : const Color(0xFFE2E8F0),
            width: isSelected ? 2 : 1.5,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected
                  ? const Color(0xFF3B760F)
                  : const Color(0xFF64748B),
              size: 32,
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isSelected
                    ? const Color(0xFF3B760F)
                    : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

