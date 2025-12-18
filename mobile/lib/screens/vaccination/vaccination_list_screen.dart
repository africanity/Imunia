import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import '../../core/widgets/app_card.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/loading_indicator.dart';
import '../../core/config/api_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

class VaccinationListScreen extends StatefulWidget {
  final String childId;
  final String? initialFilter; // 'completed', 'missed', 'due', 'late', 'all'
  
  const VaccinationListScreen({
    super.key,
    required this.childId,
    this.initialFilter,
  });

  @override
  State<VaccinationListScreen> createState() => _VaccinationListScreenState();
}

class _VaccinationListScreenState extends State<VaccinationListScreen> with SingleTickerProviderStateMixin {
  final storage = const FlutterSecureStorage();
  late TabController _tabController;
  
  bool _isLoading = true;
  Map<String, dynamic>? _dashboardData;
  String? _error;
  String? _token;
  int _initialTabIndex = 0;

  @override
  void initState() {
    super.initState();
    
    // Déterminer l'onglet initial selon le filtre
    switch (widget.initialFilter) {
      case 'completed':
        _initialTabIndex = 2;
        break;
      case 'missed':
        _initialTabIndex = 3;
        break;
      case 'due':
        _initialTabIndex = 0;
        break;
      case 'late':
        _initialTabIndex = 1;
        break;
      default:
        _initialTabIndex = 4; // Tous
    }
    
    _tabController = TabController(length: 5, initialIndex: _initialTabIndex, vsync: this);
    _loadDashboardData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadDashboardData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _token = await storage.read(key: 'auth_token');
      if (_token == null) {
        setState(() {
          _error = "Token d'authentification manquant";
          _isLoading = false;
        });
        return;
      }

      final dashboardUrl = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/children/${widget.childId}/dashboard");
      final dashboardResponse = await http.get(
        dashboardUrl,
        headers: {
          "Authorization": "Bearer $_token",
          "Content-Type": "application/json",
        },
      );

      if (dashboardResponse.statusCode == 200) {
        final dashboardData = jsonDecode(dashboardResponse.body);
        setState(() {
          _dashboardData = dashboardData;
          _isLoading = false;
        });
      } else {
        final errorData = jsonDecode(dashboardResponse.body);
        setState(() {
          _error = errorData["message"] ?? "Erreur de chargement";
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

  String _formatDate(DateTime? date) {
    if (date == null) return "-";
    return DateFormat('dd/MM/yyyy', 'fr_FR').format(date);
  }

  bool _arePreviousDosesCompleted(String? vaccineId, int currentDose, List<dynamic> completedVaccines) {
    if (vaccineId == null || currentDose <= 1) return true;
    
    // Vérifier que toutes les doses de 1 à currentDose - 1 sont complétées
    for (int dose = 1; dose < currentDose; dose++) {
      final isCompleted = completedVaccines.any((completed) {
        return completed["vaccineId"] == vaccineId && (completed["dose"] ?? 1) == dose;
      });
      
      if (!isCompleted) {
        return false;
      }
    }
    
    return true;
  }

  bool _hasExistingRequestOrScheduled(String? vaccineId, int currentDose, List<dynamic> scheduledVaccines) {
    if (vaccineId == null) return false;
    
    // Vérifier s'il existe déjà un rendez-vous programmé pour ce vaccin spécifique avec cette dose
    return scheduledVaccines.any((scheduled) {
      return scheduled["vaccineId"] == vaccineId && (scheduled["dose"] ?? 1) == currentDose;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Vaccinations'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Color(0xFF0A1A33)),
            onPressed: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
          ),
        ),
        body: const LoadingIndicator(message: 'Chargement des vaccins...'),
      );
    }

    if (_error != null || _dashboardData == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Vaccinations'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Color(0xFF0A1A33)),
            onPressed: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
          ),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 64,
                color: Colors.red[300],
              ),
              const SizedBox(height: 16),
              Text(
                _error ?? "Erreur de chargement",
                style: GoogleFonts.poppins(
                  color: const Color(0xFF64748B),
                  fontSize: 14,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loadDashboardData,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B760F),
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                ),
                child: Text(
                  "Réessayer",
                  style: GoogleFonts.poppins(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final vaccinations = _dashboardData!["vaccinations"] as Map<String, dynamic>;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0A1A33)),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
        ),
        title: Text(
          'Vaccinations',
          style: GoogleFonts.poppins(
            color: const Color(0xFF0A1A33),
            fontWeight: FontWeight.w600,
          ),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textTertiary,
          indicatorColor: AppColors.primary,
          labelStyle: GoogleFonts.poppins(
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: GoogleFonts.poppins(
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
          tabs: const [
            Tab(text: "À faire"),
            Tab(text: "En retard"),
            Tab(text: "Complétés"),
            Tab(text: "Ratés"),
            Tab(text: "Tous"),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildVaccineList(
            vaccinations["due"] as List<dynamic>,
            "Aucun vaccin à faire",
            AppColors.info,
          ),
          _buildVaccineList(
            vaccinations["late"] as List<dynamic>,
            "Aucun vaccin en retard",
            AppColors.error,
            isLate: true,
          ),
          _buildCompletedVaccineList(
            vaccinations["completed"] as List<dynamic>,
          ),
          _buildVaccineList(
            (vaccinations["overdue"] as List<dynamic>).map((v) {
              final Map<String, dynamic> vaccine = Map<String, dynamic>.from(v as Map);
              vaccine['status'] = 'overdue';
              return vaccine;
            }).toList(),
            "Aucun vaccin raté",
            AppColors.warning,
            isLate: true,
          ),
          _buildAllVaccinesList(vaccinations),
        ],
      ),
    );
  }

  Widget _buildVaccineList(List<dynamic> vaccines, String emptyMessage, Color color, {bool isLate = false}) {
    if (vaccines.isEmpty) {
      return EmptyState(
        icon: Icons.vaccines_outlined,
        title: emptyMessage,
      );
    }

    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: vaccines.length,
        itemBuilder: (context, index) {
          final vaccine = vaccines[index] as Map<String, dynamic>;
          return _buildVaccineCard(vaccine, color, isLate: isLate);
        },
      ),
    );
  }

  Widget _buildVaccineCard(Map<String, dynamic> vaccine, Color color, {bool isLate = false}) {
    final scheduledFor = vaccine["scheduledFor"] != null
        ? DateTime.tryParse(vaccine["scheduledFor"])
        : null;
    final dueDate = vaccine["dueDate"] != null
        ? DateTime.tryParse(vaccine["dueDate"])
        : null;
    
    // Déterminer si c'est un vaccin raté (overdue)
    final isOverdue = vaccine["status"] == "overdue" || 
                      (vaccine["dueDate"] != null && dueDate != null && dueDate.isBefore(DateTime.now()));
    
    // Vérifier si les doses précédentes sont complétées
    final currentDose = vaccine["dose"] ?? 1;
    final completedVaccines = _dashboardData?["vaccinations"]?["completed"] as List<dynamic>? ?? [];
    final previousDosesOk = currentDose == 1 || _arePreviousDosesCompleted(
      vaccine["vaccineId"] as String?,
      currentDose,
      completedVaccines,
    );
    
    // Vérifier s'il existe déjà une demande ou un rendez-vous programmé pour cette dose spécifique
    final scheduledVaccines = _dashboardData?["vaccinations"]?["scheduled"] as List<dynamic>? ?? [];
    final hasExistingRequestOrScheduled = _hasExistingRequestOrScheduled(
      vaccine["vaccineId"] as String?,
      currentDose,
      scheduledVaccines,
    );
    
    final canRequest = previousDosesOk && !hasExistingRequestOrScheduled;

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(
                  Icons.vaccines,
                  color: color,
                  size: 24,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      vaccine["vaccineName"] ?? "",
                      style: GoogleFonts.poppins(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF0A1A33),
                      ),
                    ),
                    if (vaccine["dosesRequired"] != null)
                      Text(
                        "Dose ${vaccine["dose"] ?? 1} / ${vaccine["dosesRequired"]}",
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (scheduledFor != null || dueDate != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Icon(
                  isLate ? Icons.warning : Icons.calendar_today,
                  size: 16,
                  color: const Color(0xFF64748B),
                ),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  isLate
                      ? "Échéance: ${_formatDate(dueDate)}"
                      : "Prévu pour: ${_formatDate(scheduledFor)}",
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ],
          if (vaccine["calendarDescription"] != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              vaccine["calendarDescription"],
              style: GoogleFonts.poppins(
                fontSize: 12,
                color: const Color(0xFF94A3B8),
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: canRequest ? () => _requestVaccine(vaccine, isOverdue: isOverdue) : null,
              icon: Icon(isOverdue ? Icons.event_repeat : Icons.event_available, size: 18),
              label: Text(
                !previousDosesOk
                    ? "Complétez d'abord les doses précédentes"
                    : hasExistingRequestOrScheduled
                        ? "Déjà programmé"
                        : (isOverdue ? "Demander une nouvelle date" : "Demander un rendez-vous"),
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: canRequest ? AppColors.primary : Colors.grey,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                disabledBackgroundColor: Colors.grey[300],
                disabledForegroundColor: Colors.grey[600],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _requestVaccine(Map<String, dynamic> vaccine, {bool isOverdue = false}) async {
    if (_token == null) return;

    // Afficher un dialogue de confirmation
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          isOverdue ? "Demander une nouvelle date" : "Demander un rendez-vous",
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
          ),
        ),
        content: Text(
          isOverdue
              ? "Voulez-vous demander une nouvelle date pour ${vaccine["vaccineName"]} (Dose ${vaccine["dose"] ?? 1}) ?"
              : "Voulez-vous demander un rendez-vous pour ${vaccine["vaccineName"]} (Dose ${vaccine["dose"] ?? 1}) ?",
          style: GoogleFonts.poppins(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              "Annuler",
              style: GoogleFonts.poppins(
                color: AppColors.textSecondary,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
            ),
            child: Text(
              "Confirmer",
              style: GoogleFonts.poppins(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    // Afficher un indicateur de chargement
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(
          color: AppColors.primary,
        ),
      ),
    );

    try {
      final url = Uri.parse(
        "${ApiConfig.apiBaseUrl}/mobile/children/${widget.childId}/vaccine-requests"
      );
      final response = await http.post(
        url,
        headers: {
          "Authorization": "Bearer $_token",
          "Content-Type": "application/json",
        },
        body: jsonEncode({
          "vaccineId": vaccine["vaccineId"],
          "vaccineCalendarId": vaccine["calendarId"],
          "dose": vaccine["dose"] ?? 1,
        }),
      );

      if (!mounted) return;
      Navigator.pop(context); // Fermer le dialogue de chargement

      if (response.statusCode == 201) {
        // Afficher un message de succès
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isOverdue
                  ? "Demande de nouvelle date envoyée avec succès. L'agent vous contactera bientôt."
                  : "Demande envoyée avec succès. L'agent vous contactera bientôt.",
              style: GoogleFonts.poppins(),
            ),
            backgroundColor: AppColors.success,
            duration: const Duration(seconds: 3),
          ),
        );
        // Recharger les données
        _loadDashboardData();
      } else {
        final errorData = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              errorData["message"] ?? "Erreur lors de l'envoi de la demande",
              style: GoogleFonts.poppins(),
            ),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context); // Fermer le dialogue de chargement
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "Erreur de connexion au serveur",
            style: GoogleFonts.poppins(),
          ),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  Widget _buildCompletedVaccineList(List<dynamic> vaccines) {
    if (vaccines.isEmpty) {
      return EmptyState(
        icon: Icons.check_circle_outline,
        title: "Aucun vaccin complété",
      );
    }

    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: vaccines.length,
        itemBuilder: (context, index) {
          final vaccine = vaccines[index];
          return _buildCompletedVaccineCard(vaccine);
        },
      ),
    );
  }

  Widget _buildCompletedVaccineCard(Map<String, dynamic> vaccine) {
    final administeredAt = vaccine["administeredAt"] != null
        ? DateTime.tryParse(vaccine["administeredAt"])
        : null;

    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: const Icon(
                  Icons.check_circle,
                  color: AppColors.success,
                  size: 24,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      vaccine["vaccineName"] ?? "",
                      style: GoogleFonts.poppins(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF0A1A33),
                      ),
                    ),
                    if (vaccine["dosesRequired"] != null)
                      Text(
                        "Dose ${vaccine["dose"] ?? 1} / ${vaccine["dosesRequired"]}",
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (administeredAt != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                const Icon(
                  Icons.calendar_today,
                  size: 16,
                  color: Color(0xFF64748B),
                ),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  "Administré le: ${_formatDate(administeredAt)}",
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ],
          if (vaccine["administeredByName"] != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                const Icon(
                  Icons.person,
                  size: 16,
                  color: Color(0xFF64748B),
                ),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  "Par: ${vaccine["administeredByName"] ?? ''}",
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAllVaccinesList(Map<String, dynamic> vaccinations) {
    final allVaccines = <Map<String, dynamic>>[];
    
    allVaccines.addAll((vaccinations["due"] as List<dynamic>).map((v) {
      final Map<String, dynamic> vaccine = Map<String, dynamic>.from(v as Map);
      vaccine['status'] = 'due';
      return vaccine;
    }));
    allVaccines.addAll((vaccinations["late"] as List<dynamic>).map((v) {
      final Map<String, dynamic> vaccine = Map<String, dynamic>.from(v as Map);
      vaccine['status'] = 'late';
      return vaccine;
    }));
    allVaccines.addAll((vaccinations["completed"] as List<dynamic>).map((v) {
      final Map<String, dynamic> vaccine = Map<String, dynamic>.from(v as Map);
      vaccine['status'] = 'completed';
      return vaccine;
    }));
    allVaccines.addAll((vaccinations["overdue"] as List<dynamic>).map((v) {
      final Map<String, dynamic> vaccine = Map<String, dynamic>.from(v as Map);
      vaccine['status'] = 'overdue';
      return vaccine;
    }));
    allVaccines.addAll((vaccinations["scheduled"] as List<dynamic>).map((v) {
      final Map<String, dynamic> vaccine = Map<String, dynamic>.from(v as Map);
      vaccine['status'] = 'scheduled';
      return vaccine;
    }));

    if (allVaccines.isEmpty) {
      return EmptyState(
        icon: Icons.vaccines_outlined,
        title: "Aucun vaccin",
      );
    }

    return RefreshIndicator(
      onRefresh: _loadDashboardData,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: allVaccines.length,
        itemBuilder: (context, index) {
          final vaccine = allVaccines[index];
          final status = vaccine['status'] as String;
          
          Color color;
          bool isLate = false;
          
          switch (status) {
            case 'completed':
              return _buildCompletedVaccineCard(vaccine);
            case 'late':
            case 'overdue':
              color = AppColors.error;
              isLate = true;
              break;
            case 'due':
              color = AppColors.info;
              break;
            default:
              color = AppColors.primary;
          }
          
          return _buildVaccineCard(vaccine, color, isLate: isLate);
        },
      ),
    );
  }
}


