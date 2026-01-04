import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_card.dart';
import '../../core/widgets/section_header.dart';
import '../../services/api_service.dart';
import '../../services/settings_service.dart';
import '../../models/system_settings.dart';
import '../onboarding/onboarding_screen.dart';
import 'children_selector_screen.dart';
import 'change_pin_screen.dart';
import 'help_faq_screen.dart';
import 'contact_support_screen.dart';

class ProfileScreen extends StatefulWidget {
  final Map<String, dynamic> child;
  
  const ProfileScreen({super.key, required this.child});
  
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final storage = const FlutterSecureStorage();
  bool _isLoading = false;
  Map<String, dynamic> _childData = {};
  int _totalChildren = 0;
  SystemSettings? _settings;
  
  @override
  void initState() {
    super.initState();
    _childData = Map.from(widget.child);
    _loadSettings();
    _loadChildData();
    _checkTotalChildren();
  }

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
  
  Future<void> _loadChildData() async {
    setState(() {
      _isLoading = true;
    });
    
    try {
      final childId = widget.child['id'] ?? widget.child['_id'];
      if (childId != null) {
        final dashboardData = await ApiService.getVaccinationStats(childId);
        if (dashboardData['child'] != null) {
          setState(() {
            _childData = Map<String, dynamic>.from(dashboardData['child']);
          });
        }
      }
    } catch (e) {
      // Keep existing data if API fails
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Impossible de mettre à jour les données: ${e.toString()}'),
            backgroundColor: AppColors.warning,
          ),
        );
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  Future<void> _checkTotalChildren() async {
    try {
      final children = await ApiService.getParentChildren();
      setState(() {
        _totalChildren = children.length;
      });
    } catch (e) {
      // Ignore errors silently
    }
  }
  
  void _showChildrenSelector() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const ChildrenSelectorScreen(),
      ),
    );
  }
  
  String get childName => _childData['firstName'] != null && _childData['lastName'] != null
      ? '${_childData['firstName']} ${_childData['lastName']}'
      : _childData['name'] ?? _childData['firstName'] ?? 'Enfant';
  String get childGender => _childData['gender'] ?? 'M';
  String get childId => _childData['id'] ?? _childData['_id'] ?? '';
  String get birthDate {
    final dateStr = _childData['birthDate'] ?? _childData['dateOfBirth'];
    if (dateStr == null || dateStr.toString().isEmpty) return 'Non définie';
    try {
      final date = DateTime.parse(dateStr.toString());
      return DateFormat('dd/MM/yyyy').format(date);
    } catch (e) {
      return dateStr.toString();
    }
  }
  String get age {
    final dateStr = _childData['birthDate'] ?? _childData['dateOfBirth'];
    if (dateStr == null || dateStr.toString().isEmpty) return '';
    try {
      final birthDate = DateTime.parse(dateStr.toString());
      final today = DateTime.now();
      int years = today.year - birthDate.year;
      if (today.month < birthDate.month ||
          (today.month == birthDate.month && today.day < birthDate.day)) {
        years--;
      }
      return years > 0 ? '$years an${years > 1 ? "s" : ""}' : '';
    } catch (e) {
      return '';
    }
  }
  String get healthCenter {
    if (_childData['healthCenter'] is Map) {
      return _childData['healthCenter']?['name'] ?? 'Non défini';
    }
    return _childData['healthCenter'] ?? _childData['registrationCenter'] ?? 'Non défini';
  }
  String get parentName => _childData['parentName'] ?? 'Parent';
  String get parentPhone => _childData['parentPhone'] ?? _childData['phoneParent'] ?? 'Non défini';
  
  void _showChangePinDialog() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const ChangePinScreen(),
      ),
    );
  }
  
  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text(
          'Êtes-vous sûr de vouloir vous déconnecter ?',
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () async {
              await storage.deleteAll();
              if (!mounted) return;
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(
                  builder: (_) => const OnboardingScreen(),
                ),
                (route) => false,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            child: const Text('Déconnexion'),
          ),
        ],
      ),
    );
  }
  
  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('À propos'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _settings?.appName ?? 'Imunia',
              style: GoogleFonts.poppins(
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Version 1.0.0',
              style: AppTextStyles.bodySmall,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Application de gestion du carnet de vaccination électronique.',
              style: AppTextStyles.bodyMedium.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            const Text(
              'Powered by Africanity Group',
              style: TextStyle(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Fermer'),
          ),
        ],
      ),
    );
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Profil'),
        actions: [
          if (_totalChildren >= 1)
            IconButton(
              icon: Stack(
                children: [
                  const Icon(Icons.people_outline_rounded),
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        color: AppColors.error,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      child: Text(
                        _totalChildren.toString(),
                        style: const TextStyle(
                          color: AppColors.surface,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ],
              ),
              tooltip: 'Changer d\'enfant',
              onPressed: _showChildrenSelector,
            ),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(16.0),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadChildData,
        color: AppColors.primary,
        child: SingleChildScrollView(
          child: Column(
          children: [
            // Header with child info
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.xl),
              decoration: BoxDecoration(
                color: AppColors.surface,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Avatar
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: childGender == 'F'
                          ? Colors.pink.withOpacity(0.1)
                          : Colors.blue.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      childGender == 'F'
                          ? Icons.girl_rounded
                          : Icons.boy_rounded,
                      size: 50,
                      color: childGender == 'F'
                          ? Colors.pink[400]
                          : Colors.blue[400],
                    ),
                  ),
                  
                  const SizedBox(height: AppSpacing.md),
                  
                  // Name
                  Text(
                    childName,
                    style: AppTextStyles.h2,
                    textAlign: TextAlign.center,
                  ),
                  
                  const SizedBox(height: AppSpacing.xs),
                  
                  // ID
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppRadius.full),
                    ),
                    child: Text(
                      'ID: $childId',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: AppSpacing.lg),
            
            // Informations section
            const SectionHeader(
              title: 'Informations',
              icon: Icons.person_outline_rounded,
            ),
            
            InfoCard(
              title: 'Date de naissance',
              subtitle: age.isNotEmpty ? '$birthDate ($age)' : birthDate,
              icon: Icons.cake_outlined,
              color: AppColors.info,
            ),
            
            InfoCard(
              title: 'Genre',
              subtitle: childGender == 'F' ? 'Fille' : 'Garçon',
              icon: Icons.wc_rounded,
              color: AppColors.secondary,
            ),
            
            if (healthCenter.isNotEmpty && healthCenter != 'Non défini')
              InfoCard(
                title: 'Centre de santé',
                subtitle: healthCenter,
                icon: Icons.local_hospital_outlined,
                color: AppColors.success,
              ),
            
            const SizedBox(height: AppSpacing.lg),
            
            // Parent info section
            const SectionHeader(
              title: 'Contact parent',
              icon: Icons.family_restroom_rounded,
            ),
            
            InfoCard(
              title: parentName,
              subtitle: parentPhone,
              icon: Icons.phone_outlined,
              color: AppColors.warning,
            ),
            
            const SizedBox(height: AppSpacing.lg),
            
            // Parametres section
            const SectionHeader(
              title: 'Paramètres',
              icon: Icons.settings_outlined,
            ),
            
            if (_totalChildren >= 1)
              InfoCard(
                title: 'Changer d\'enfant',
                subtitle: '$_totalChildren carnet${_totalChildren > 1 ? "s" : ""} disponible${_totalChildren > 1 ? "s" : ""}',
                icon: Icons.swap_horiz_rounded,
                color: AppColors.secondary,
                onTap: _showChildrenSelector,
              ),
            
            InfoCard(
              title: 'Changer le code PIN',
              subtitle: 'Modifier votre code de sécurité',
              icon: Icons.lock_outline_rounded,
              color: AppColors.primary,
              onTap: _showChangePinDialog,
            ),
            
            const SizedBox(height: AppSpacing.lg),
            
            // Support section
            const SectionHeader(
              title: 'Support',
              icon: Icons.help_outline_rounded,
            ),
            
            InfoCard(
              title: 'Aide et FAQ',
              subtitle: 'Questions fréquemment posées',
              icon: Icons.help_outline_rounded,
              color: AppColors.info,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const HelpFaqScreen(),
                  ),
                );
              },
            ),
            
            InfoCard(
              title: 'Contactez-nous',
              subtitle: 'Besoin d\'aide ? Nous sommes là',
              icon: Icons.mail_outline_rounded,
              color: AppColors.secondary,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const ContactSupportScreen(),
                  ),
                );
              },
            ),
            
            InfoCard(
              title: 'À propos',
              subtitle: 'Version et informations',
              icon: Icons.info_outline_rounded,
              color: AppColors.primary,
              onTap: _showAboutDialog,
            ),
            
            const SizedBox(height: AppSpacing.xl),
            
            // Logout button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _showLogoutDialog,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: AppColors.error, width: 1.5),
                    padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.logout_rounded, size: 20),
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        'Déconnexion',
                        style: AppTextStyles.button.copyWith(
                          color: AppColors.error,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            
            const SizedBox(height: AppSpacing.xl),
            
            // Version
            Text(
              '${_settings?.appName ?? "Imunia"} v1.0.0',
              style: AppTextStyles.caption,
            ),
            
            const SizedBox(height: AppSpacing.sm),
            
            Text(
              'Powered by Africanity Group',
              style: AppTextStyles.caption.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
        ),
      ),
    );
  }
}

