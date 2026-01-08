import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/config/api_config.dart';
import 'pin_login_screen.dart';

class ForgotPinScreen extends StatefulWidget {
  const ForgotPinScreen({super.key});

  @override
  State<ForgotPinScreen> createState() => _ForgotPinScreenState();
}

class _ForgotPinScreenState extends State<ForgotPinScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final List<TextEditingController> _verificationCodeControllers = 
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _verificationCodeFocusNodes = List.generate(6, (_) => FocusNode());
  final List<TextEditingController> _newPinControllers = 
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _newPinFocusNodes = List.generate(4, (_) => FocusNode());
  final List<TextEditingController> _confirmPinControllers = 
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _confirmPinFocusNodes = List.generate(4, (_) => FocusNode());
  
  bool _isLoading = false;
  String? _error;
  int _step = 1; // 1: numéro, 2: code WhatsApp, 3: nouveau PIN, 4: confirmation

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 300), () {
      if (mounted) {
        _phoneController.selection = TextSelection.fromPosition(
          TextPosition(offset: _phoneController.text.length),
        );
      }
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
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

  String _getCode() {
    return _verificationCodeControllers.map((c) => c.text).join();
  }

  String _getPin(List<TextEditingController> controllers) {
    return controllers.map((c) => c.text).join();
  }

  void _clearCode() {
    for (var controller in _verificationCodeControllers) {
      controller.clear();
    }
  }

  void _clearPin(List<TextEditingController> controllers) {
    for (var controller in controllers) {
      controller.clear();
    }
  }

  Future<void> _requestVerificationCode() async {
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\s'), '');
    
    if (phone.isEmpty) {
      setState(() {
        _error = "Veuillez entrer votre numéro de téléphone";
      });
      return;
    }

    // Validation basique du numéro
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(phone)) {
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
      final response = await http.post(
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/parent-pin/forgot-pin-request'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'phone': phone,
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
          _error = data['message'] ?? "Erreur lors de la demande du code";
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = "Erreur de connexion. Veuillez réessayer.";
      });
    }
  }

  Future<void> _verifyCode() async {
    final code = _getCode();
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\s'), '');
    
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

    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/parent-pin/verify-forgot-pin-code'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'phone': phone,
          'verificationCode': code,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // Code valide, passer à l'étape suivante
        setState(() {
          _isLoading = false;
          _step = 3;
        });
        Future.delayed(const Duration(milliseconds: 100), () {
          _newPinFocusNodes[0].requestFocus();
        });
      } else {
        setState(() {
          _isLoading = false;
          _error = data['message'] ?? "Code de vérification incorrect ou expiré";
          _clearCode();
        });
        _verificationCodeFocusNodes[0].requestFocus();
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = "Erreur de connexion. Veuillez réessayer.";
        _clearCode();
      });
      _verificationCodeFocusNodes[0].requestFocus();
    }
  }

  Future<void> _resetPin() async {
    final newPin = _getPin(_newPinControllers);
    final confirmPin = _getPin(_confirmPinControllers);
    final verificationCode = _getCode();
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\s'), '');

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
      final response = await http.post(
        Uri.parse('${ApiConfig.apiBaseUrl}/mobile/parent-pin/reset-pin'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: json.encode({
          'phone': phone,
          'verificationCode': verificationCode,
          'newPin': newPin,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        if (!mounted) return;
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ PIN réinitialisé avec succès. Vous pouvez maintenant vous connecter.'),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 3),
          ),
        );
        
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => const PinLoginScreen(),
          ),
        );
      } else {
        setState(() {
          _isLoading = false;
          _error = data['message'] ?? "Erreur lors de la réinitialisation";
          _clearCode();
          _clearPin(_newPinControllers);
          _clearPin(_confirmPinControllers);
        });
        setState(() {
          _step = 2;
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

  void _onCodeChanged(int index, String value) {
    if (value.isNotEmpty && index < 5) {
      _verificationCodeFocusNodes[index + 1].requestFocus();
    }

    final code = _getCode();
    if (code.length == 6) {
      _verifyCode();
    }
  }

  void _onPinDigitChanged(int index, String value, List<TextEditingController> controllers, List<FocusNode> focusNodes) {
    if (value.isNotEmpty && index < 3) {
      focusNodes[index + 1].requestFocus();
    }

    final pin = _getPin(controllers);
    if (pin.length == 4) {
      if (_step == 3) {
        setState(() {
          _step = 4;
        });
        Future.delayed(const Duration(milliseconds: 100), () {
          _confirmPinFocusNodes[0].requestFocus();
        });
      } else {
        _resetPin();
      }
    }
  }

  Widget _buildCodeFields() {
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
            onChanged: (value) => _onCodeChanged(index, value),
            onTap: () {
              _verificationCodeControllers[index].clear();
            },
          ),
        );
      }),
    );
  }

  Widget _buildPinFields(List<TextEditingController> controllers, List<FocusNode> focusNodes) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(4, (index) {
        return Container(
          width: 60,
          height: 60,
          margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
          child: TextField(
            controller: controllers[index],
            focusNode: focusNodes[index],
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
            onChanged: (value) => _onPinDigitChanged(index, value, controllers, focusNodes),
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
        title: const Text('Code PIN oublié'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () {
            if (_step > 1 && !_isLoading) {
              setState(() {
                _step--;
                _error = null;
                if (_step == 1) {
                  _phoneController.clear();
                } else if (_step == 2) {
                  _clearCode();
                } else if (_step == 3) {
                  _clearPin(_newPinControllers);
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
                      _buildProgressLine(),
                      _buildProgressDot(4),
                    ],
                  ),
                  
                  const SizedBox(height: AppSpacing.xxl),
                  
                  // Icon
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.lock_reset_rounded,
                      size: 60,
                      color: AppColors.warning,
                    ),
                  ),
                  
                  const SizedBox(height: AppSpacing.xl),
                  
                  // Title
                  Text(
                    _step == 1
                        ? 'Numéro de téléphone'
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
                        ? 'Entrez votre numéro de téléphone pour recevoir un code de réinitialisation'
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
                  
                  // Fields
                  if (_step == 1)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                      child: TextField(
                        controller: _phoneController,
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
                  else if (_step == 2)
                    _buildCodeFields()
                  else if (_step == 3)
                    _buildPinFields(_newPinControllers, _newPinFocusNodes)
                  else
                    _buildPinFields(_confirmPinControllers, _confirmPinFocusNodes),
                  
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
                  
                  if (_step == 1 && !_isLoading)
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
                            _step == 1
                                ? 'Un code de réinitialisation sera envoyé sur votre WhatsApp'
                                : _step == 2
                                    ? 'Le code a été envoyé sur votre WhatsApp. Vérifiez vos messages.'
                                    : 'Votre nouveau code PIN sera utilisé pour vous connecter à l\'application',
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
