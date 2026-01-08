import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/config/api_config.dart';

class ChangePinScreen extends StatefulWidget {
  const ChangePinScreen({super.key});

  @override
  State<ChangePinScreen> createState() => _ChangePinScreenState();
}

class _ChangePinScreenState extends State<ChangePinScreen> {
  final _storage = const FlutterSecureStorage();
  
  // Controllers pour l'ancien PIN
  final List<TextEditingController> _oldPinControllers = 
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _oldPinFocusNodes = List.generate(4, (_) => FocusNode());
  
  // Controllers pour le code WhatsApp
  final List<TextEditingController> _verificationCodeControllers = 
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _verificationCodeFocusNodes = List.generate(6, (_) => FocusNode());
  
  // Controllers pour le nouveau PIN
  final List<TextEditingController> _newPinControllers = 
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _newPinFocusNodes = List.generate(4, (_) => FocusNode());
  
  // Controllers pour la confirmation
  final List<TextEditingController> _confirmPinControllers = 
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _confirmPinFocusNodes = List.generate(4, (_) => FocusNode());
  
  bool _isLoading = false;
  String? _error;
  int _step = 1; // 1: ancien PIN, 2: code WhatsApp, 3: nouveau PIN, 4: confirmation

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 300), () {
      if (mounted) {
        _oldPinFocusNodes[0].requestFocus();
      }
    });
  }

  @override
  void dispose() {
    for (var controller in _oldPinControllers) {
      controller.dispose();
    }
    for (var node in _oldPinFocusNodes) {
      node.dispose();
    }
    for (var controller in _verificationCodeControllers) {
      controller.dispose();
    }
    for (var node in _verificationCodeFocusNodes) {
      node.dispose();
    }
    for (var controller in _newPinControllers) {
      controller.dispose();
    }
    for (var node in _newPinFocusNodes) {
      node.dispose();
    }
    for (var controller in _confirmPinControllers) {
      controller.dispose();
    }
    for (var node in _confirmPinFocusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  String _getPin(List<TextEditingController> controllers) {
    return controllers.map((c) => c.text).join();
  }

  void _clearPin(List<TextEditingController> controllers) {
    for (var controller in controllers) {
      controller.clear();
    }
  }

  Future<void> _verifyOldPinAndRequestCode() async {
    final oldPin = _getPin(_oldPinControllers);
    
    if (oldPin.length != 4) {
      setState(() {
        _error = "Veuillez entrer votre code PIN actuel";
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
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/parent-pin/request-change-code'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'childId': childId,
          'parentPhone': parentPhone,
          'oldPin': oldPin,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _isLoading = false;
          _step = 2;
        });
        Future.delayed(const Duration(milliseconds: 100), () {
          _verificationCodeFocusNodes[0].requestFocus();
        });
      } else {
        setState(() {
          _isLoading = false;
          _error = data['message'] ?? "Code PIN incorrect";
          _clearPin(_oldPinControllers);
        });
        _oldPinFocusNodes[0].requestFocus();
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = "Erreur de connexion. Veuillez réessayer.";
      });
    }
  }

  Future<void> _verifyCode() async {
    final code = _getPin(_verificationCodeControllers);
    
    if (code.length != 6) {
      setState(() {
        _error = "Veuillez entrer le code à 6 chiffres reçu par WhatsApp";
      });
      return;
    }
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    // Pour l'instant, on passe directement à l'étape suivante
    // La vérification du code se fera lors du changement final du PIN
    setState(() {
      _isLoading = false;
      _step = 3;
    });
    Future.delayed(const Duration(milliseconds: 100), () {
      _newPinFocusNodes[0].requestFocus();
    });
  }

  Future<void> _changePin() async {
    final newPin = _getPin(_newPinControllers);
    final confirmPin = _getPin(_confirmPinControllers);
    final verificationCode = _getPin(_verificationCodeControllers);

    if (newPin != confirmPin) {
      setState(() {
        _error = "Les codes PIN ne correspondent pas";
        _clearPin(_confirmPinControllers);
      });
      _confirmPinFocusNodes[0].requestFocus();
      return;
    }

    if (newPin.length != 4) {
      setState(() {
        _error = "Le code PIN doit contenir 4 chiffres";
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
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/parent-pin/change'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'childId': childId,
          'parentPhone': parentPhone,
          'verificationCode': verificationCode,
          'newPin': newPin,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        if (!mounted) return;
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Code PIN modifié avec succès'),
            backgroundColor: AppColors.success,
          ),
        );
        
        Navigator.pop(context);
      } else {
        setState(() {
          _isLoading = false;
          _error = data['message'] ?? "Erreur lors de la modification";
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = "Erreur de connexion. Veuillez réessayer.";
      });
    }
  }

  void _onPinDigitChanged(int index, String value, int currentStep) {
    if (value.isNotEmpty && index < (currentStep == 2 ? 5 : 3)) {
      if (currentStep == 1) {
        _oldPinFocusNodes[index + 1].requestFocus();
      } else if (currentStep == 2) {
        _verificationCodeFocusNodes[index + 1].requestFocus();
      } else if (currentStep == 3) {
        _newPinFocusNodes[index + 1].requestFocus();
      } else {
        _confirmPinFocusNodes[index + 1].requestFocus();
      }
    }

    // Vérifier si le PIN/code est complet
    List<TextEditingController> controllers;
    if (currentStep == 1) {
      controllers = _oldPinControllers;
    } else if (currentStep == 2) {
      controllers = _verificationCodeControllers;
    } else if (currentStep == 3) {
      controllers = _newPinControllers;
    } else {
      controllers = _confirmPinControllers;
    }

    final pin = _getPin(controllers);
    if ((currentStep == 2 && pin.length == 6) || (currentStep != 2 && pin.length == 4)) {
      if (currentStep == 1) {
        _verifyOldPinAndRequestCode();
      } else if (currentStep == 2) {
        _verifyCode();
      } else if (currentStep == 3) {
        setState(() {
          _step = 4;
        });
        Future.delayed(const Duration(milliseconds: 100), () {
          _confirmPinFocusNodes[0].requestFocus();
        });
      } else {
        _changePin();
      }
    }
  }

  void _onPinDigitDeleted(int index, int currentStep) {
    if (index > 0) {
      if (currentStep == 1) {
        _oldPinFocusNodes[index - 1].requestFocus();
      } else if (currentStep == 2) {
        _verificationCodeFocusNodes[index - 1].requestFocus();
      } else if (currentStep == 3) {
        _newPinFocusNodes[index - 1].requestFocus();
      } else {
        _confirmPinFocusNodes[index - 1].requestFocus();
      }
    }
  }

  Widget _buildPinFields(
    List<TextEditingController> controllers,
    List<FocusNode> focusNodes,
    int currentStep,
    int fieldCount,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(fieldCount, (index) {
        return Container(
          width: fieldCount == 6 ? 45 : 60,
          height: 60,
          margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
          child: TextField(
            controller: controllers[index],
            focusNode: focusNodes[index],
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 1,
            obscureText: currentStep != 2, // Ne pas masquer le code WhatsApp
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
            onChanged: (value) => _onPinDigitChanged(index, value, currentStep),
            onTap: () {
              controllers[index].clear();
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
        title: const Text('Changer le code PIN'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () {
            if (_step > 1 && !_isLoading) {
              setState(() {
                _step--;
                _error = null;
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
                  _buildProgressLine(),
                  _buildProgressDot(4),
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
                  Icons.lock_reset_rounded,
                  size: 60,
                  color: AppColors.primary,
                ),
              ),
              
              const SizedBox(height: AppSpacing.xl),
              
              // Title
              Text(
                _step == 1
                    ? 'Code PIN actuel'
                    : _step == 2
                        ? 'Code de vérification'
                        : _step == 3
                            ? 'Nouveau code PIN'
                            : 'Confirmez le nouveau PIN',
                style: AppTextStyles.h2,
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: AppSpacing.sm),
              
              // Subtitle
              Text(
                _step == 1
                    ? 'Entrez votre code PIN actuel'
                    : _step == 2
                        ? 'Entrez le code à 6 chiffres reçu par WhatsApp'
                        : _step == 3
                            ? 'Choisissez un nouveau code à 4 chiffres'
                            : 'Entrez à nouveau votre nouveau PIN',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: AppSpacing.xxl),
              
              // PIN/Code fields
              if (_step == 1)
                _buildPinFields(_oldPinControllers, _oldPinFocusNodes, 1, 4)
              else if (_step == 2)
                _buildPinFields(_verificationCodeControllers, _verificationCodeFocusNodes, 2, 6)
              else if (_step == 3)
                _buildPinFields(_newPinControllers, _newPinFocusNodes, 3, 4)
              else
                _buildPinFields(_confirmPinControllers, _confirmPinFocusNodes, 4, 4),
              
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
                            ? 'Un code de vérification a été envoyé sur votre WhatsApp. Entrez-le pour continuer.'
                            : 'Votre nouveau code PIN sera utilisé pour sécuriser l\'accès à l\'application',
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
