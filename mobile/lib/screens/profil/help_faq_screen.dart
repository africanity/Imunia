import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

class HelpFaqScreen extends StatefulWidget {
  const HelpFaqScreen({super.key});

  @override
  State<HelpFaqScreen> createState() => _HelpFaqScreenState();
}

class _HelpFaqScreenState extends State<HelpFaqScreen> {
  final List<FaqItem> _faqs = [
    FaqItem(
      category: 'Compte et sécurité',
      icon: Icons.lock_outline_rounded,
      questions: [
        FaqQuestion(
          question: 'Comment créer un compte ?',
          answer: 'Pour créer un compte, entrez le numéro de téléphone du parent et l\'ID de l\'enfant reçu par SMS lors de l\'enregistrement au centre de santé. Un code PIN à 4 chiffres vous sera demandé pour sécuriser l\'accès.',
        ),
        FaqQuestion(
          question: 'J\'ai oublié mon code PIN, que faire ?',
          answer: 'Sur l\'écran de saisie du PIN, appuyez sur "Code PIN oublié". Vous devrez vous reconnecter avec votre numéro de téléphone et l\'ID de l\'enfant pour définir un nouveau code PIN.',
        ),
        FaqQuestion(
          question: 'Comment changer mon code PIN ?',
          answer: 'Allez dans Profil > Paramètres > Changer le code PIN. Vous devrez d\'abord entrer votre code PIN actuel, puis un code de vérification vous sera envoyé par WhatsApp. Après avoir saisi le code, vous pourrez définir votre nouveau PIN.',
        ),
        FaqQuestion(
          question: 'Mes données sont-elles sécurisées ?',
          answer: 'Oui, vos données sont protégées par un code PIN et stockées de manière sécurisée. Les communications avec le serveur sont cryptées.',
        ),
      ],
    ),
    FaqItem(
      category: 'Vaccinations',
      icon: Icons.vaccines_outlined,
      questions: [
        FaqQuestion(
          question: 'Comment consulter les vaccins de mon enfant ?',
          answer: 'Dans l\'onglet "Vaccins", vous pouvez voir tous les vaccins : administrés, programmés, à faire et en retard. Vous pouvez également voir l\'historique complet de toutes les vaccinations.',
        ),
        FaqQuestion(
          question: 'Que signifient les différents statuts ?',
          answer: '• À jour : Tous les vaccins sont à jour\n• En retard : Des vaccins sont manqués\n• Programmé : Un rendez-vous est prévu\n• Complété : Le vaccin a été administré\n• À faire : Vaccin à administrer dans les prochains jours\n• Raté : Vaccin manqué qui doit être rattrapé',
        ),
        FaqQuestion(
          question: 'Comment savoir quand vacciner mon enfant ?',
          answer: 'Les rendez-vous de vaccination sont programmés par votre centre de santé. Vous recevrez des notifications de rappel avant chaque rendez-vous. Vous pouvez également consulter l\'onglet "Calendrier" pour voir le planning complet.',
        ),
        FaqQuestion(
          question: 'Puis-je voir le calendrier vaccinal ?',
          answer: 'Oui, allez dans l\'onglet "Calendrier" pour voir le planning complet des vaccinations de votre enfant avec les dates et les vaccins recommandés selon l\'âge.',
        ),
        FaqQuestion(
          question: 'Comment demander un rendez-vous pour un vaccin ?',
          answer: 'Dans l\'onglet "Vaccins", pour chaque vaccin "À faire" ou "En retard", vous pouvez cliquer sur "Demander un rendez-vous". Votre demande sera envoyée à votre centre de santé qui programmera le rendez-vous.',
        ),
      ],
    ),
    FaqItem(
      category: 'Rendez-vous',
      icon: Icons.event_outlined,
      questions: [
        FaqQuestion(
          question: 'Comment voir mes rendez-vous ?',
          answer: 'Sur le tableau de bord (onglet "Accueil"), vous verrez les rendez-vous à venir. Vous pouvez également accéder à la section "Rendez-vous" depuis les fonctionnalités pour voir tous vos rendez-vous : à venir, passés et manqués.',
        ),
        FaqQuestion(
          question: 'Puis-je annuler un rendez-vous ?',
          answer: 'Non, vous ne pouvez pas annuler directement depuis l\'application. Contactez votre centre de santé pour reprogrammer un rendez-vous.',
        ),
        FaqQuestion(
          question: 'Je reçois des rappels de rendez-vous ?',
          answer: 'Oui, vous recevrez des notifications push quelques jours avant chaque rendez-vous. Assurez-vous d\'avoir activé les notifications dans les paramètres de votre téléphone pour l\'application Imunia.',
        ),
        FaqQuestion(
          question: 'Que faire si j\'ai raté un rendez-vous ?',
          answer: 'Si vous avez raté un rendez-vous, le vaccin apparaîtra dans la liste "Ratés". Vous pouvez cliquer sur "Demander une nouvelle date" pour demander un nouveau rendez-vous à votre centre de santé.',
        ),
      ],
    ),
    FaqItem(
      category: 'Notifications',
      icon: Icons.notifications_outlined,
      questions: [
        FaqQuestion(
          question: 'Je ne reçois pas de notifications',
          answer: 'Vérifiez que les notifications sont activées dans les paramètres de votre téléphone pour l\'application Imunia. Les notifications sont envoyées pour les rendez-vous programmés, les vaccins manqués, les nouvelles campagnes et les conseils de santé.',
        ),
        FaqQuestion(
          question: 'Quels types de notifications puis-je recevoir ?',
          answer: 'Vous recevrez des notifications pour : les rendez-vous de vaccination programmés, les vaccins manqués ou en retard, les nouvelles campagnes de vaccination, les nouveaux conseils de santé disponibles, et les modifications du calendrier vaccinal.',
        ),
        FaqQuestion(
          question: 'Comment consulter l\'historique des notifications ?',
          answer: 'Appuyez sur l\'icône cloche (🔔) en haut à droite du tableau de bord ou accédez à la section "Notifications" dans les fonctionnalités pour voir toutes vos notifications.',
        ),
      ],
    ),
    FaqItem(
      category: 'Plusieurs enfants',
      icon: Icons.people_outline_rounded,
      questions: [
        FaqQuestion(
          question: 'Puis-je gérer plusieurs enfants ?',
          answer: 'Oui, si vous avez plusieurs enfants enregistrés avec le même numéro de téléphone, vous pouvez basculer entre leurs carnets en allant dans Profil > Paramètres > Changer d\'enfant.',
        ),
        FaqQuestion(
          question: 'Comment ajouter un autre enfant ?',
          answer: 'Votre centre de santé vous fournira un nouvel ID pour chaque enfant. Utilisez cet ID avec votre numéro de téléphone pour accéder au carnet de cet enfant lors de la connexion.',
        ),
        FaqQuestion(
          question: 'Dois-je créer un nouveau PIN par enfant ?',
          answer: 'Non, un seul code PIN est utilisé pour accéder à tous les carnets de vos enfants enregistrés avec le même numéro de téléphone.',
        ),
      ],
    ),
    FaqItem(
      category: 'Campagnes',
      icon: Icons.campaign_outlined,
      questions: [
        FaqQuestion(
          question: 'Qu\'est-ce qu\'une campagne de vaccination ?',
          answer: 'Les campagnes sont des programmes de vaccination organisés par les autorités sanitaires pour vacciner un grand nombre d\'enfants contre une maladie spécifique.',
        ),
        FaqQuestion(
          question: 'Comment savoir si mon enfant est concerné ?',
          answer: 'Vous recevrez une notification si une campagne concerne votre enfant. Les détails seront disponibles dans la section "Campagnes" accessible depuis les fonctionnalités.',
        ),
        FaqQuestion(
          question: 'Où puis-je voir les campagnes actives ?',
          answer: 'Accédez à la section "Campagnes" depuis les fonctionnalités du tableau de bord pour voir toutes les campagnes actives et leurs détails.',
        ),
      ],
    ),
    FaqItem(
      category: 'Conseils de santé',
      icon: Icons.lightbulb_outline_rounded,
      questions: [
        FaqQuestion(
          question: 'Qu\'est-ce que les conseils de santé ?',
          answer: 'Les conseils de santé sont des informations et recommandations pour prendre soin de la santé de votre enfant, adaptées à son âge.',
        ),
        FaqQuestion(
          question: 'Comment consulter les conseils ?',
          answer: 'Accédez à la section "Conseils" depuis les fonctionnalités du tableau de bord pour voir tous les conseils disponibles.',
        ),
        FaqQuestion(
          question: 'Les conseils sont-ils personnalisés ?',
          answer: 'Oui, les conseils sont adaptés à l\'âge de votre enfant et vous recevrez des notifications lorsque de nouveaux conseils sont disponibles.',
        ),
      ],
    ),
  ];

  String _searchQuery = '';
  
  List<FaqItem> get _filteredFaqs {
    if (_searchQuery.isEmpty) return _faqs;
    
    return _faqs.map((category) {
      final filteredQuestions = category.questions.where((q) =>
        q.question.toLowerCase().contains(_searchQuery.toLowerCase()) ||
        q.answer.toLowerCase().contains(_searchQuery.toLowerCase())
      ).toList();
      
      return FaqItem(
        category: category.category,
        icon: category.icon,
        questions: filteredQuestions,
      );
    }).where((category) => category.questions.isNotEmpty).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Aide et FAQ'),
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: TextField(
              onChanged: (value) => setState(() => _searchQuery = value),
              decoration: InputDecoration(
                hintText: 'Rechercher une question...',
                prefixIcon: const Icon(Icons.search_rounded),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.full),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          
          // FAQ List
          Expanded(
            child: _filteredFaqs.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.search_off_rounded,
                          size: 80,
                          color: Colors.grey[300],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          'Aucun résultat trouvé',
                          style: AppTextStyles.bodyLarge.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    itemCount: _filteredFaqs.length,
                    padding: const EdgeInsets.only(bottom: AppSpacing.xl),
                    itemBuilder: (context, index) {
                      final category = _filteredFaqs[index];
                      return _buildCategorySection(category);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategorySection(FaqItem category) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category Header
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.sm,
          ),
          child: Row(
            children: [
              Icon(category.icon, size: 20, color: AppColors.primary),
              const SizedBox(width: AppSpacing.sm),
              Text(
                category.category,
                style: AppTextStyles.h4.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        
        // Questions
        ...category.questions.map((question) => _buildQuestionTile(question)),
      ],
    );
  }

  Widget _buildQuestionTile(FaqQuestion question) {
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          childrenPadding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            0,
            AppSpacing.md,
            AppSpacing.md,
          ),
          leading: Container(
            padding: const EdgeInsets.all(AppSpacing.xs),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: const Icon(
              Icons.help_outline_rounded,
              color: AppColors.primary,
              size: 20,
            ),
          ),
          title: Text(
            question.question,
            style: AppTextStyles.bodyLarge.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          children: [
            Text(
              question.answer,
              style: AppTextStyles.bodyMedium.copyWith(
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class FaqItem {
  final String category;
  final IconData icon;
  final List<FaqQuestion> questions;

  FaqItem({
    required this.category,
    required this.icon,
    required this.questions,
  });
}

class FaqQuestion {
  final String question;
  final String answer;

  FaqQuestion({
    required this.question,
    required this.answer,
  });
}
