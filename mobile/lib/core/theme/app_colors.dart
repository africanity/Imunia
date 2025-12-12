import 'package:flutter/material.dart';

/// 🎨 Palette de couleurs VacxCare - Thème Santé
class AppColors {
  // Couleurs principales - Thème médical/santé
  static const Color primary = Color(0xFF1E88E5); // Bleu médical professionnel
  static const Color primaryDark = Color(0xFF1565C0); // Bleu foncé
  static const Color primaryLight = Color(0xFF64B5F6); // Bleu clair
  
  static const Color secondary = Color(0xFF2E7D32); // Vert vaccination/santé
  static const Color secondaryDark = Color(0xFF1B5E20); // Vert foncé
  static const Color secondaryLight = Color(0xFF66BB6A); // Vert clair
  
  static const Color accent = Color(0xFF00ACC1); // Cyan accent moderne
  
  // Fond et surface - Tons clairs et propres
  static const Color background = Color(0xFFF5F8FA); // Gris très clair
  static const Color surface = Color(0xFFFFFFFF); // Blanc pur
  static const Color surfaceVariant = Color(0xFFECEFF1); // Gris bleuté clair
  static const Color surfaceContainer = Color(0xFFF0F4F7); // Container subtle
  
  // Texte - Hiérarchie claire
  static const Color textPrimary = Color(0xFF1A365D); // Bleu marine texte
  static const Color textSecondary = Color(0xFF475569); // Gris moyen
  static const Color textTertiary = Color(0xFF94A3B8); // Gris clair
  static const Color textDisabled = Color(0xFFCBD5E1); // Gris très clair
  static const Color textOnPrimary = Color(0xFFFFFFFF); // Texte sur fond coloré
  
  // Bordures et dividers - Subtils
  static const Color border = Color(0xFFE0E7EF);
  static const Color divider = Color(0xFFE0E7EF);
  
  // Statuts - Codes couleur médicaux
  static const Color success = Color(0xFF2E7D32); // Vert validation/succès
  static const Color successLight = Color(0xFFE8F5E9); // Fond vert clair
  static const Color successBorder = Color(0xFFA5D6A7); // Bordure verte
  
  static const Color warning = Color(0xFFF57C00); // Orange attention
  static const Color warningLight = Color(0xFFFFF3E0); // Fond orange clair
  static const Color warningBorder = Color(0xFFFFCC80); // Bordure orange
  
  static const Color error = Color(0xFFD32F2F); // Rouge erreur/danger
  static const Color errorLight = Color(0xFFFFEBEE); // Fond rouge clair
  static const Color errorBorder = Color(0xFFEF9A9A); // Bordure rouge
  
  static const Color info = Color(0xFF1976D2); // Bleu information
  static const Color infoLight = Color(0xFFE3F2FD); // Fond bleu clair
  static const Color infoBorder = Color(0xFF90CAF9); // Bordure bleue
  
  // États des vaccins - Codes couleur clairs
  static const Color vaccineDone = Color(0xFF2E7D32); // Vert - Complété
  static const Color vaccinePending = Color(0xFFF57C00); // Orange - En attente
  static const Color vaccineOverdue = Color(0xFFD32F2F); // Rouge - En retard
  static const Color vaccineScheduled = Color(0xFF1976D2); // Bleu - Programmé
  static const Color vaccineUpcoming = Color(0xFF00ACC1); // Cyan - À venir
  
  // Gradients santé
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1E88E5), Color(0xFF2E7D32)],
  );
  
  static const LinearGradient lightGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFF5F8FA), Color(0xFFFFFFFF)],
  );
  
  // Overlay
  static const Color overlay = Color(0x1A000000); // 10% noir
  static const Color overlayMedium = Color(0x33000000); // 20% noir
  static const Color overlayDark = Color(0x66000000); // 40% noir
  
  // Couleurs spécifiques santé
  static const Color cardiacRed = Color(0xFFE57373); // Rouge cardiaque
  static const Color medicalBlue = Color(0xFF42A5F5); // Bleu médical
  static const Color healthGreen = Color(0xFF66BB6A); // Vert santé
  static const Color vitaminOrange = Color(0xFFFFB74D); // Orange vitamine
}



