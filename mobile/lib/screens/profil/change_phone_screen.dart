import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/config/api_config.dart';

class ChangePhoneScreen extends StatefulWidget {
  const ChangePhoneScreen({super.key});

  @override
  State<ChangePhoneScreen> createState() => _ChangePhoneScreenState();
}

class _ChangePhoneScreenState extends State<ChangePhoneScreen> {
  final _storage = const FlutterSecureStorage();
  
  // Controller pour le PIN
  final List<TextEditingController> _pinControllers = 
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _pinFocusNodes = List.generate(4, (_) => FocusNode());
  
  // Controller pour le nouveau numéro
  final TextEditingController _newPhoneController = TextEditingController();
  final FocusNode _newPhoneFocusNode = FocusNode();
  
  // Controllers pour le code WhatsApp
  final List<TextEditingController> _verificationCodeControllers = 
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _verificationCodeFocusNodes = List.generate(6, (_) => FocusNode());
  
  bool _isLoading = false;
  String? _error;
  int _step = 1; // 1: PIN, 2: nouveau numéro, 3: code WhatsApp

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 300), () {
      if (mounted) {
        _pinFocusNodes[0].requestFocus();
      }
    });
  }

  @override
  void dispose() {
    for (var controller in _pinControllers) {
      controller.dispose();
    }
    for (var node in _pinFocusNodes) {
      node.dispose();
    }
    _newPhoneController.dispose();
    _newPhoneFocusNode.dispose();
    for (var controller in _verificationCodeControllers) {
      controller.dispose();
    }
    for (var node in _verificationCodeFocusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  String _getPin() {
    return _pinControllers.map((c) => c.text).join();
  }

  void _clearPin() {
    for (var controller in _pinControllers) {
      controller.clear();
    }
  }

  void _clearVerificationCode() {
    for (var controller in _verificationCodeControllers) {
      controller.clear();
    }
  }

  Future<void> _verifyPinAndRequestCode() async {
    final pin = _getPin();
    
    if (pin.length != 4) {
      setState(() {
        _error = "Veuillez entrer votre code PIN";
      });
      return;
    }
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final token = await _storage.read(key: 'auth_token');
      final childId = await _storage.read(key: 'child_id');
      final parentPhone = await _storage.read(key: 'parent_phone');

      if (token == null || childId == null || parentPhone == null) {
        setState(() {
          _isLoading = false;
          _error = "Session expirée. Veuillez vous reconnecter.";
        });
        return;
      }

      // Vérifier le PIN avec l'endpoint de vérification
      final response = await http.post(
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/parent-pin/verify'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'childId': childId,
          'parentPhone': parentPhone,
          'pin': pin,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // PIN valide, passer à l'étape suivante
        setState(() {
          _isLoading = false;
          _step = 2;
        });
        Future.delayed(const Duration(milliseconds: 100), () {
          _newPhoneFocusNode.requestFocus();
        });
      } else {
        setState(() {
          _isLoading = false;
          _error = data['message'] ?? "PIN incorrect";
          _clearPin();
        });
        _pinFocusNodes[0].requestFocus();
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = "Erreur de connexion. Veuillez réessayer.";
        _clearPin();
      });
      _pinFocusNodes[0].requestFocus();
    }
  }

  Future<void> _requestVerificationCode() async {
    final pin = _getPin();
    final newPhone = _newPhoneController.text.trim().replaceAll(RegExp(r'\s'), '');
    
    if (newPhone.isEmpty) {
      setState(() {
        _error = "Veuillez entrer le nouveau numéro de téléphone";
      });
      return;
    }

    // Validation basique du numéro
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(newPhone.replaceAll(RegExp(r'\s'), ''))) {
      setState(() {
        _error = "Format de numéro de téléphone invalide";
      });
      return;
    }
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final token = await _storage.read(key: 'auth_token');
      final childId = await _storage.read(key: 'child_id');
      final parentPhone = await _storage.read(key: 'parent_phone');

      if (token == null || childId == null || parentPhone == null) {
        setState(() {
          _isLoading = false;
          _error = "Session expirée. Veuillez vous reconnecter.";
        });
        return;
      }

      final response = await http.post(
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/parent-phone/request-change-code'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'childId': childId,
          'parentPhone': parentPhone,
          'pin': pin,
          'newPhone': newPhone,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _isLoading = false;
          _step = 3;
        });
        Future.delayed(const Duration(milliseconds: 100), () {
          _verificationCodeFocusNodes[0].requestFocus();
        });
      } else {
        setState(() {
          _isLoading = false;
          _error = data['message'] ?? "Erreur lors de la demande du code";
          _clearPin();
        });
        _pinFocusNodes[0].requestFocus();
        setState(() {
          _step = 1;
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = "Erreur de connexion. Veuillez réessayer.";
      });
    }
  }

  Future<void> _changePhone() async {
    final verificationCode = _verificationCodeControllers.map((c) => c.text).join();
    
    if (verificationCode.length != 6) {
      setState(() {
        _error = "Veuillez entrer le code à 6 chiffres reçu par WhatsApp";
      });
      return;
    }
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final token = await _storage.read(key: 'auth_token');
      final childId = await _storage.read(key: 'child_id');
      final parentPhone = await _storage.read(key: 'parent_phone');

      if (token == null || childId == null || parentPhone == null) {
        setState(() {
          _isLoading = false;
          _error = "Session expirée. Veuillez vous reconnecter.";
        });
        return;
      }

      final response = await http.post(
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/parent-phone/change'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'childId': childId,
          'parentPhone': parentPhone,
          'verificationCode': verificationCode,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        if (!mounted) return;
        
        // Mettre à jour le numéro dans le stockage
        final newPhone = data['newPhone'] ?? _newPhoneController.text.trim();
        await _storage.write(key: 'parent_phone', value: newPhone);
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Numéro de téléphone modifié avec succès'),
            backgroundColor: AppColors.success,
          ),
        );
        
        Navigator.pop(context);
      } else {
        setState(() {
          _isLoading = false;
          _error = data['message'] ?? "Erreur lors de la modification";
          _clearVerificationCode();
        });
        _verificationCodeFocusNodes[0].requestFocus();
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = "Erreur de connexion. Veuillez réessayer.";
      });
    }
  }

  void _onPinDigitChanged(int index, String value) {
    if (value.isNotEmpty && index < 3) {
      _pinFocusNodes[index + 1].requestFocus();
    }

    final pin = _getPin();
    if (pin.length == 4) {
      _verifyPinAndRequestCode();
    }
  }

  void _onPinDigitDeleted(int index) {
    if (index > 0) {
      _pinFocusNodes[index - 1].requestFocus();
    }
  }

  void _onVerificationCodeChanged(int index, String value) {
    if (value.isNotEmpty && index < 5) {
      _verificationCodeFocusNodes[index + 1].requestFocus();
    }

    final code = _verificationCodeControllers.map((c) => c.text).join();
    if (code.length == 6) {
      _changePhone();
    }
  }

  void _onVerificationCodeDeleted(int index) {
    if (index > 0) {
      _verificationCodeFocusNodes[index - 1].requestFocus();
    }
  }

  Widget _buildPinFields() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(4, (index) {
        return Container(
          width: 60,
          height: 60,
          margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
          child: TextField(
            controller: _pinControllers[index],
            focusNode: _pinFocusNodes[index],
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 1,
            obscureText: true,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
            ),
            decoration: InputDecoration(
              counterText: '',
              filled: true,
              fillColor: AppColors.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: const BorderSide(color: AppColors.border, width: 2),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: const BorderSide(color: AppColors.border, width: 2),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: const BorderSide(color: AppColors.primary, width: 2),
              ),
            ),
            onChanged: (value) => _onPinDigitChanged(index, value),
            onTap: () {
              _pinControllers[index].clear();
            },
          ),
        );
      }),
    );
  }

  Widget _buildVerificationCodeFields() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(6, (index) {
        return Container(
          width: 45,
          height: 60,
          margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
          child: TextField(
            controller: _verificationCodeControllers[index],
            focusNode: _verificationCodeFocusNodes[index],
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 1,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
            ),
            decoration: InputDecoration(
              counterText: '',
              filled: true,
              fillColor: AppColors.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: const BorderSide(color: AppColors.border, width: 2),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: const BorderSide(color: AppColors.border, width: 2),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
                borderSide: const BorderSide(color: AppColors.primary, width: 2),
              ),
            ),
            onChanged: (value) => _onVerificationCodeChanged(index, value),
            onTap: () {
              _verificationCodeControllers[index].clear();
            },
          ),
        );
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Changer de numéro'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () {
            if (_step > 1 && !_isLoading) {
              setState(() {
                _step--;
                _error = null;
                if (_step == 1) {
                  _clearPin();
                } else if (_step == 2) {
                  _newPhoneController.clear();
                }
              });
            } else {
              Navigator.pop(context);
            }
          },
        ),
      ),
      body: SafeArea(
        child: Transform.translate(
          offset: const Offset(0, -AppRadius.lg),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(AppRadius.lg),
                topRight: Radius.circular(AppRadius.lg),
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg + AppRadius.lg, AppSpacing.lg, AppSpacing.lg),
              child: Column(
                children: [
                  const SizedBox(height: AppSpacing.md),
                  
                  // Progress indicator
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _buildProgressDot(1),
                      _buildProgressLine(),
                      _buildProgressDot(2),
                      _buildProgressLine(),
                      _buildProgressDot(3),
                    ],
                  ),
                  
                  const SizedBox(height: AppSpacing.xxl),
                  
                  // Icon
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.phone_android_rounded,
                      size: 60,
                      color: AppColors.primary,
                    ),
                  ),
                  
                  const SizedBox(height: AppSpacing.xl),
                  
                  // Title
                  Text(
                    _step == 1
                        ? 'Vérification du PIN'
                        : _step == 2
                            ? 'Nouveau numéro'
                            : 'Code de vérification',
                    style: AppTextStyles.h2,
                    textAlign: TextAlign.center,
                  ),
                  
                  const SizedBox(height: AppSpacing.sm),
                  
                  // Subtitle
                  Text(
                    _step == 1
                        ? 'Entrez votre code PIN pour continuer'
                        : _step == 2
                            ? 'Entrez votre nouveau numéro de téléphone'
                            : 'Entrez le code à 6 chiffres reçu par WhatsApp',
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  
                  const SizedBox(height: AppSpacing.xxl),
                  
                  // PIN/Phone/Code fields
                  if (_step == 1)
                    _buildPinFields()
                  else if (_step == 2)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                      child: TextField(
                        controller: _newPhoneController,
                        focusNode: _newPhoneFocusNode,
                        keyboardType: TextInputType.phone,
                        textAlign: TextAlign.center,
                        style: AppTextStyles.h2,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: AppColors.surface,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            borderSide: const BorderSide(color: AppColors.border, width: 2),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            borderSide: const BorderSide(color: AppColors.border, width: 2),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            borderSide: const BorderSide(color: AppColors.primary, width: 2),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.lg,
                          ),
                        ),
                        onSubmitted: (_) {
                          _requestVerificationCode();
                        },
                      ),
                    )
                  else
                    _buildVerificationCodeFields(),
                  
                  const SizedBox(height: AppSpacing.lg),
                  
                  // Error message
                  if (_error != null)
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, color: AppColors.error, size: 20),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              _error!,
                              style: AppTextStyles.bodySmall.copyWith(
                                color: AppColors.error,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  
                  const SizedBox(height: AppSpacing.xl),
                  
                  // Loading indicator
                  if (_isLoading)
                    const CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                    ),
                  
                  if (_step == 2 && !_isLoading)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _requestVerificationCode,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(AppRadius.md),
                            ),
                          ),
                          child: Text(
                            'Envoyer le code',
                            style: AppTextStyles.button,
                          ),
                        ),
                      ),
                    ),
                  
                  const SizedBox(height: AppSpacing.lg),
                  
                  // Info
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.infoLight,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.info_outline_rounded,
                          color: AppColors.info,
                          size: 20,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            _step == 2
                                ? 'Un code de vérification sera envoyé sur votre nouveau numéro de téléphone'
                                : 'Votre nouveau numéro sera utilisé pour toutes les notifications et communications',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.info,
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
        ),
      ),
    );
  }

  Widget _buildProgressDot(int stepNumber) {
    final isActive = _step >= stepNumber;
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: isActive ? AppColors.primary : AppColors.border,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          stepNumber.toString(),
          style: TextStyle(
            color: isActive ? AppColors.surface : AppColors.textSecondary,
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _buildProgressLine() {
    return Container(
      width: 40,
      height: 2,
      color: AppColors.border,
    );
  }
}
