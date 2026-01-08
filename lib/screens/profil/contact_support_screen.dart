import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

class ContactSupportScreen extends StatelessWidget {
  const ContactSupportScreen({super.key});

  Future<void> _launchPhone(BuildContext context, String phoneNumber) async {
    final uri = Uri.parse('tel:$phoneNumber');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Impossible d\'ouvrir l\'application téléphone'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _launchEmail(BuildContext context, String email) async {
    final uri = Uri.parse('mailto:$email?subject=Support');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Impossible d\'ouvrir l\'application email'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _launchWhatsApp(BuildContext context, String phoneNumber) async {
    final uri = Uri.parse('https://wa.me/$phoneNumber');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('WhatsApp n\'est pas installé'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _copyToClipboard(BuildContext context, String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copié dans le presse-papiers'),
        backgroundColor: AppColors.success,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Contactez-nous'),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.xl),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.primary,
                    AppColors.primary.withOpacity(0.8),
                  ],
                ),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.headset_mic_rounded,
                      size: 60,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text(
                    'Nous sommes là pour vous aider',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  const Text(
                    'Notre équipe de support est disponible pour répondre à toutes vos questions',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: AppSpacing.lg),
            
            // Horaires
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.infoLight,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.access_time_rounded,
                      color: AppColors.info,
                      size: 24,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Horaires d\'ouverture',
                            style: AppTextStyles.bodyLarge.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppColors.info,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'Lundi - Vendredi : 8h00 - 18h00\nSamedi : 9h00 - 13h00',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: AppColors.info,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: AppSpacing.lg),
            
            // Moyens de contact
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Moyens de contact',
                    style: AppTextStyles.h4.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  
                  // Téléphone
                  _ContactCard(
                    icon: Icons.phone_rounded,
                    iconColor: AppColors.success,
                    title: 'Téléphone',
                    subtitle: '+221762796367',
                    actions: [
                      _ContactAction(
                        icon: Icons.call_rounded,
                        label: 'Appeler',
                        color: AppColors.success,
                        onTap: () => _launchPhone(context, '+221762796367'),
                      ),
                      _ContactAction(
                        icon: Icons.content_copy_rounded,
                        label: 'Copier',
                        color: AppColors.secondary,
                        onTap: () => _copyToClipboard(context, '+221762796367', 'Numéro'),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: AppSpacing.md),
                  
                  // WhatsApp
                  _ContactCard(
                    icon: Icons.chat_rounded,
                    iconColor: const Color(0xFF25D366),
                    title: 'WhatsApp',
                    subtitle: '+221762796367',
                    actions: [
                      _ContactAction(
                        icon: Icons.send_rounded,
                        label: 'Message',
                        color: const Color(0xFF25D366),
                        onTap: () => _launchWhatsApp(context, '221762796367'),
                      ),
                      _ContactAction(
                        icon: Icons.content_copy_rounded,
                        label: 'Copier',
                        color: AppColors.secondary,
                        onTap: () => _copyToClipboard(context, '+221762796367', 'Numéro'),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: AppSpacing.md),
                  
                  // Email
                  _ContactCard(
                    icon: Icons.email_rounded,
                    iconColor: AppColors.error,
                    title: 'Email',
                    subtitle: 'daibra2005@gmail.com',
                    actions: [
                      _ContactAction(
                        icon: Icons.mail_outline_rounded,
                        label: 'Envoyer',
                        color: AppColors.error,
                        onTap: () => _launchEmail(context, 'daibra2005@gmail.com'),
                      ),
                      _ContactAction(
                        icon: Icons.content_copy_rounded,
                        label: 'Copier',
                        color: AppColors.secondary,
                        onTap: () => _copyToClipboard(context, 'daibra2005@gmail.com', 'Email'),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: AppSpacing.md),
                  
                  // Adresse
                  _ContactCard(
                    icon: Icons.location_on_rounded,
                    iconColor: AppColors.warning,
                    title: 'Adresse',
                    subtitle: 'Sacré-Coeur 3\nDakar, Sénégal',
                    actions: [
                      _ContactAction(
                        icon: Icons.content_copy_rounded,
                        label: 'Copier',
                        color: AppColors.secondary,
                        onTap: () => _copyToClipboard(
                          context,
                          'Sacré-Coeur 3, Dakar, Sénégal',
                          'Adresse',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: AppSpacing.xl),
            
            // FAQ rapide
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.lightbulb_outline_rounded,
                          color: AppColors.warning,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          'Besoin d\'aide rapidement ?',
                          style: AppTextStyles.bodyLarge.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Consultez notre FAQ pour trouver des réponses aux questions les plus fréquentes.',
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pushNamed(context, '/help-faq');
                        },
                        icon: const Icon(Icons.help_outline_rounded, size: 20),
                        label: const Text('Voir la FAQ'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.warning,
                          padding: const EdgeInsets.symmetric(
                            vertical: AppSpacing.md,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final List<_ContactAction> actions;

  const _ContactCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Icon(icon, color: iconColor, size: 28),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTextStyles.bodyLarge.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      subtitle,
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (actions.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: actions.map((action) {
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4.0),
                    child: OutlinedButton.icon(
                      onPressed: action.onTap,
                      icon: Icon(action.icon, size: 18),
                      label: Text(action.label),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: action.color,
                        side: BorderSide(color: action.color),
                        padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.sm,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

class _ContactAction {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  _ContactAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
}
