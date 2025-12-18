import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter_ringtone_player/flutter_ringtone_player.dart';
import '../../core/widgets/app_card.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/config/api_config.dart';
import '../../services/api_service.dart';
import '../vaccination/vaccination_list_screen.dart';
import '../appointments/appointments_screen.dart';
import '../calendrier/calendrier_screen.dart';
import '../stats/health_stats_screen.dart';
import '../conseils/health_tips_screen.dart';
import '../campagnes/campagne_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profil/profile_screen.dart';
import '../../screens/auth/vaccination_proof_upload_screen.dart';

class ChildDashboardScreen extends StatefulWidget {
  final Map<String, dynamic>? userData;
  final String childId;
  
  const ChildDashboardScreen({
    super.key,
    this.userData,
    required this.childId,
  });

  @override
  State<ChildDashboardScreen> createState() => _ChildDashboardScreenState();
}

class _ChildDashboardScreenState extends State<ChildDashboardScreen> {
  final storage = const FlutterSecureStorage();
  
  bool _isLoading = true;
  Map<String, dynamic>? _dashboardData;
  String? _error;
  String? _token;
  int _notificationCount = 0;
  IO.Socket? _socket;
  List<Map<String, dynamic>> _upcomingAppointments = [];
  int _currentIndex = 0; // 0: Accueil, 1: Vaccins, 2: Calendrier, 3: Profil

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
    _connectToSocket();
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _socket?.dispose();
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

      // Charger les données du dashboard
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
        final childData = dashboardData['child'] as Map<String, dynamic>? ?? {};
        final isActive = childData['isActive'] ?? false;
        final photosRequested = childData['photosRequested'] ?? false;

        // Vérifier si l'accès doit être bloqué
        if (photosRequested) {
          setState(() {
            _error = "Veuillez télécharger de nouvelles photos du carnet de vaccination pour continuer à utiliser l'application.";
            _isLoading = false;
          });
          // Afficher un dialogue pour forcer l'upload
          Future.microtask(() => _showPhotoRequestDialog());
          return;
        }

        setState(() {
          _dashboardData = dashboardData;
          // Initialiser le compteur de notifications depuis les données
          final unreadCount = dashboardData['unreadNotifications'] ?? 0;
          _notificationCount = unreadCount;
        });

        // Charger les rendez-vous à venir (de manière asynchrone pour ne pas bloquer)
        Future.microtask(() => _loadUpcomingAppointments());

        // Reconnecter le socket avec les nouvelles données (après un court délai)
        Future.delayed(const Duration(milliseconds: 500), () {
          if (_socket == null || !_socket!.connected) {
            _connectToSocket();
          } else {
            // Si déjà connecté, rejoindre les rooms avec les nouvelles données
            final child = _dashboardData?["child"] as Map<String, dynamic>?;
            final parentPhone = child?["parentPhone"] as String?;
            if (parentPhone != null && _socket != null && _socket!.connected) {
              _socket!.emit('join', {
                'room': 'parent',
                'phone': parentPhone,
              });
              _socket!.emit('join', {
                'room': 'all',
              });
              _socket!.emit('join', {
                'room': widget.childId,
              });
            }
          }
        });

      } else {
        final errorData = jsonDecode(dashboardResponse.body);
        setState(() {
          _error = errorData["message"] ?? "Erreur de chargement";
        });
      }
    } catch (e) {
      setState(() {
        _error = "Erreur de connexion au serveur";
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _refreshNotificationCount() async {
    try {
      final count = await ApiService.getUnreadNotificationsCount(widget.childId);
      if (!mounted) return;
      setState(() {
        _notificationCount = count;
      });
    } catch (_) {}
  }

  Future<void> _showPhotoRequestDialog() async {
    if (!mounted) return;
    
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Text(
          "Photos requises",
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        ),
        content: Text(
          "Veuillez télécharger de nouvelles photos du carnet de vaccination pour continuer à utiliser l'application.",
          style: GoogleFonts.poppins(),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              // Naviguer vers la page d'upload de photos
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(
                  builder: (_) => VaccinationProofUploadScreen(
                    childId: widget.childId,
                    token: _token ?? "",
                    userData: widget.userData ?? {},
                  ),
                ),
              );
            },
            child: Text(
              "Télécharger des photos",
              style: GoogleFonts.poppins(
                color: const Color(0xFF3B760F),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          title: Text(
            "Tableau de bord",
            style: GoogleFonts.poppins(
              color: const Color(0xFF0A1A33),
              fontWeight: FontWeight.w600,
            ),
          ),
          centerTitle: true,
        ),
        body: const Center(
          child: CircularProgressIndicator(
            color: Color(0xFF3B760F),
          ),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          title: Text(
            "Tableau de bord",
            style: GoogleFonts.poppins(
              color: const Color(0xFF0A1A33),
              fontWeight: FontWeight.w600,
            ),
          ),
          centerTitle: true,
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
                _error!,
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

    if (_dashboardData == null) {
      return const SizedBox.shrink();
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: _buildBody(),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBody() {
    if (_dashboardData == null) {
      return const SizedBox.shrink();
    }

    switch (_currentIndex) {
      case 0:
        return _buildHomeTab();
      case 1:
        return VaccinationListScreen(
          childId: widget.childId,
          initialFilter: null,
        );
      case 2:
        return CalendrierVaccinalScreen(
          child: _dashboardData!["child"] as Map<String, dynamic>,
        );
      case 3:
        return ProfileScreen(child: _dashboardData!["child"] as Map<String, dynamic>);
      default:
        return _buildHomeTab();
    }
  }

  Widget _buildHomeTab() {
    if (_dashboardData == null) {
      return const SizedBox.shrink();
    }

    final child = _dashboardData!["child"] as Map<String, dynamic>;
    final stats = _dashboardData!["stats"] as Map<String, dynamic>;
    final parentName = child["parentName"] ?? "";

    return CustomScrollView(
      slivers: [
        // Header avec "Bonjour" et nom du parent
        SliverAppBar(
          expandedHeight: 100,
          floating: false,
          pinned: true,
          backgroundColor: const Color(0xFF0A1A33),
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(
              fit: StackFit.expand,
              children: [
                  // Image en arrière-plan
                  Image.asset(
                    'assets/images/onboarding1.png',
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        color: const Color(0xFF0A1A33),
                      );
                    },
                  ),
                  // Overlay bleu transparent
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          const Color(0xFF0A1A33).withOpacity(0.85),
                          const Color(0xFF1A2F4F).withOpacity(0.80),
                        ],
                      ),
                    ),
                  ),
                  // Contenu du header
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Row(
                            children: [
                              // Avatar
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white.withOpacity(0.3),
                                    width: 2,
                                  ),
                                ),
                                child: const Icon(
                                  Icons.person,
                                  color: Colors.white,
                                  size: 28,
                                ),
                              ),
                              const SizedBox(width: 12),
                              // Name and greeting
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Bonjour 👋',
                                      style: GoogleFonts.poppins(
                                        fontSize: 14,
                                        color: Colors.white.withOpacity(0.9),
                                        fontWeight: FontWeight.w400,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      parentName.isNotEmpty ? parentName : "Parent",
                                      style: GoogleFonts.poppins(
                                        fontSize: 20,
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              // Bouton profil
                              IconButton(
                                onPressed: () {
                                  if (_dashboardData != null) {
                                    final child = _dashboardData!["child"] as Map<String, dynamic>;
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => ProfileScreen(child: child),
                                      ),
                                    );
                                  }
                                },
                                icon: const Icon(
                                  Icons.person_outline_rounded,
                                  color: Colors.white,
                                  size: 24,
                                ),
                                tooltip: 'Profil',
                              ),
                              const SizedBox(width: 8),
                              // Notification badge
                              GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => NotificationsScreen(
                                        apiBase: ApiConfig.baseUrl,
                                        child: _dashboardData?["child"] as Map<String, dynamic>? ?? {},
                                        onNotificationChanged: () {
                                          _loadDashboardData();
                                        },
                                      ),
                                    ),
                                  ).then((_) {
                                    _loadDashboardData();
                                  });
                                },
                                child: Stack(
                                  clipBehavior: Clip.none,
                                  children: [
                                    Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        color: Colors.white.withOpacity(0.15),
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(
                                        Icons.notifications_outlined,
                                        color: Colors.white,
                                        size: 24,
                                      ),
                                    ),
                                    if (_notificationCount > 0)
                                      Positioned(
                                        right: -2,
                                        top: -2,
                                        child: Container(
                                          padding: const EdgeInsets.all(4),
                                          decoration: const BoxDecoration(
                                            color: Color(0xFFD32F2F),
                                            shape: BoxShape.circle,
                                          ),
                                          constraints: const BoxConstraints(
                                            minWidth: 20,
                                            minHeight: 20,
                                          ),
                                          child: Text(
                                            _notificationCount > 99 ? '99+' : _notificationCount.toString(),
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                            ),
                                            textAlign: TextAlign.center,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        // Badge de vérification si le compte n'est pas activé
        if (_dashboardData != null)
          Builder(
            builder: (context) {
              final child = _dashboardData!["child"] as Map<String, dynamic>? ?? {};
              final isActive = child["isActive"] ?? false;
              if (isActive) {
                return const SliverToBoxAdapter(child: SizedBox.shrink());
              }
              return SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFA726).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: const Color(0xFFFFA726).withOpacity(0.3),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.hourglass_empty_rounded,
                          color: Color(0xFFFFA726),
                          size: 24,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Compte en attente de vérification",
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFFE65100),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                "Votre compte est en cours de vérification par un agent. Vous serez notifié une fois qu'il sera activé.",
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  color: const Color(0xFFE65100).withOpacity(0.8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        // Prochain rendez-vous (entre le header et les blocs de statistiques)
        if (_upcomingAppointments.isNotEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Prochain rendez-vous',
                        style: GoogleFonts.poppins(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF0A1A33),
                        ),
                      ),
                      if (_upcomingAppointments.length > 1)
                        TextButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => AppointmentsScreen(childId: widget.childId),
                              ),
                            );
                          },
                          child: Text(
                            'Voir tout (${_upcomingAppointments.length})',
                            style: GoogleFonts.poppins(
                              fontSize: 14,
                              color: const Color(0xFF3B760F),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Afficher seulement le prochain rendez-vous (le premier de la liste)
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => AppointmentsScreen(childId: widget.childId),
                        ),
                      );
                    },
                    child: _buildAppointmentCard(_upcomingAppointments.first),
                  ),
                ],
              ),
            ),
          ),
        // Contenu principal - 4 blocs de statistiques
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              children: [
                // Première ligne : Vaccins faits et Vaccins ratés
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        label: 'Vaccins faits',
                        value: stats["totalCompleted"].toString(),
                        icon: Icons.check_circle_outline,
                        color: AppColors.success,
                        subtitle: 'Sur ${(stats["totalDue"] ?? 0) + (stats["totalCompleted"] ?? 0) + (stats["totalLate"] ?? 0) + (stats["totalOverdue"] ?? 0)}',
                        onTap: () => _navigateToVaccines('completed'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        label: 'Vaccins ratés',
                        value: (stats["totalOverdue"] ?? 0).toString(),
                        icon: Icons.warning_amber_rounded,
                        color: AppColors.warning,
                        subtitle: 'À rattraper',
                        onTap: () => _navigateToVaccines('missed'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                // Deuxième ligne : Restants et Vaccins en retard
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        label: 'Restants',
                        value: stats["totalDue"].toString(),
                        icon: Icons.pending_outlined,
                        color: AppColors.info,
                        subtitle: 'À faire',
                        onTap: () => _navigateToVaccines('due'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: StatCard(
                        label: 'Vaccins en retard',
                        value: stats["totalLate"].toString(),
                        icon: Icons.error_outline_rounded,
                        color: AppColors.error,
                        subtitle: 'En retard',
                        onTap: () => _navigateToVaccines('late'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        // Grille de fonctionnalités
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Fonctionnalités',
                  style: GoogleFonts.poppins(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF0A1A33),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                _buildFeaturesGrid(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFeaturesGrid() {
    final features = [
      {
        'title': 'Rendez-vous',
        'icon': Icons.calendar_today_outlined,
        'color': AppColors.secondary,
        'onTap': () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => AppointmentsScreen(childId: widget.childId),
            ),
          );
        },
      },
      {
        'title': 'Calendrier',
        'icon': Icons.event_note_outlined,
        'color': AppColors.warning,
        'onTap': () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CalendrierVaccinalScreen(
                child: _dashboardData?["child"] as Map<String, dynamic>? ?? {},
              ),
            ),
          );
        },
      },
      {
        'title': 'Statistiques',
        'icon': Icons.analytics_outlined,
        'color': AppColors.success,
        'onTap': () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => HealthStatsScreen(
                child: _dashboardData?["child"] as Map<String, dynamic>? ?? {},
              ),
            ),
          );
        },
      },
      {
        'title': 'Conseils',
        'icon': Icons.lightbulb_outline_rounded,
        'color': AppColors.warning,
        'onTap': () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const HealthTipsScreen(),
            ),
          );
        },
      },
      {
        'title': 'Campagnes',
        'icon': Icons.campaign_outlined,
        'color': AppColors.error,
        'onTap': () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const CampagneScreen(),
            ),
          );
        },
      },
      {
        'title': 'Notifications',
        'icon': Icons.notifications_outlined,
        'color': AppColors.info,
        'badge': _notificationCount > 0 ? _notificationCount.toString() : null,
        'onTap': () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => NotificationsScreen(
                apiBase: ApiConfig.baseUrl,
                child: _dashboardData?["child"] as Map<String, dynamic>? ?? {},
                onNotificationChanged: () {
                  // Recharger les données pour mettre à jour le compteur
                  _loadDashboardData();
                },
              ),
            ),
          ).then((_) {
            // Recharger les données quand on revient de l'écran notifications
            // pour mettre à jour le compteur (les notifications ont été marquées comme lues)
            _loadDashboardData();
          });
        },
      },
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: AppSpacing.md,
        mainAxisSpacing: AppSpacing.md,
        childAspectRatio: 0.85,
      ),
      itemCount: features.length,
      itemBuilder: (context, index) {
        final feature = features[index];
        return _buildFeatureCard(
          title: feature['title'] as String,
          icon: feature['icon'] as IconData,
          color: feature['color'] as Color,
          onTap: feature['onTap'] as VoidCallback,
          badge: feature['badge'] as String?,
        );
      },
    );
  }

  Widget _buildFeatureCard({
    required String title,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    String? badge,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.xs,
                vertical: AppSpacing.sm,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Center(
                      child: Icon(
                        icon,
                        color: color,
                        size: 30,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Text(
                      title,
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF0A1A33),
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            if (badge != null)
              Positioned(
                top: 6,
                right: 6,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: AppColors.error,
                    shape: BoxShape.circle,
                  ),
                  constraints: const BoxConstraints(
                    minWidth: 20,
                    minHeight: 20,
                  ),
                  child: Text(
                    badge,
                    style: GoogleFonts.poppins(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _navigateToVaccines(String filter) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => VaccinationListScreen(
          childId: widget.childId,
          initialFilter: filter,
        ),
      ),
    );
  }

  Future<void> _loadUpcomingAppointments() async {
    if (!mounted) return;
    
    try {
      final appointments = await ApiService.getAppointments(widget.childId);
      if (!mounted) return;
      
      // Filtrer uniquement les rendez-vous à venir (date >= aujourd'hui)
      final now = DateTime.now();
      final upcoming = appointments.where((apt) {
        final dateStr = apt['appointmentDate'] ?? apt['date'];
        if (dateStr == null || dateStr.isEmpty) return false;
        try {
          final date = DateTime.parse(dateStr);
          return date.isAfter(now) || date.isAtSameMomentAs(now);
        } catch (e) {
          return false;
        }
      }).toList();
      
      // Trier par date (plus proche en premier) avec gestion d'erreur
      try {
        upcoming.sort((a, b) {
          final dateStrA = a['appointmentDate'] ?? a['date'] ?? '';
          final dateStrB = b['appointmentDate'] ?? b['date'] ?? '';
          if (dateStrA.isEmpty || dateStrB.isEmpty) return 0;
          try {
            final dateA = DateTime.parse(dateStrA);
            final dateB = DateTime.parse(dateStrB);
            return dateA.compareTo(dateB);
          } catch (e) {
            return 0;
          }
        });
      } catch (e) {
        // Ignorer les erreurs de tri
      }

      if (mounted) {
        setState(() {
          _upcomingAppointments = upcoming.take(3).toList(); // Limiter à 3 rendez-vous
        });
      }
    } catch (e) {
      // Ignorer les erreurs silencieusement
    }
  }

  Widget _buildAppointmentCard(Map<String, dynamic> appointment) {
    final dateStr = appointment['appointmentDate'] ?? appointment['date'] ?? '';
    final vaccineName = appointment['vaccineName'] ?? appointment['vaccine'] ?? 'Vaccination';
    final status = appointment['status'] ?? 'scheduled';
    final dose = appointment['dose'];
    
    DateTime? appointmentDate;
    try {
      appointmentDate = DateTime.parse(dateStr);
    } catch (e) {
      return const SizedBox.shrink();
    }

    final now = DateTime.now();
    final isToday = appointmentDate.year == now.year &&
        appointmentDate.month == now.month &&
        appointmentDate.day == now.day;
    final isTomorrow = appointmentDate.year == now.year &&
        appointmentDate.month == now.month &&
        appointmentDate.day == now.day + 1;

    String dateLabel;
    if (isToday) {
      dateLabel = "Aujourd'hui";
    } else if (isTomorrow) {
      dateLabel = "Demain";
    } else {
      final formatter = DateFormat('EEEE d MMMM', 'fr_FR');
      dateLabel = formatter.format(appointmentDate);
      dateLabel = dateLabel[0].toUpperCase() + dateLabel.substring(1);
    }

    final timeStr = appointment['appointmentTime'] ?? appointment['time'] ?? '';
    final timeLabel = timeStr.isNotEmpty ? ' à $timeStr' : '';

    Color statusColor;
    IconData statusIcon;
    String statusText;
    
    switch (status.toLowerCase()) {
      case 'completed':
        statusColor = AppColors.success;
        statusIcon = Icons.check_circle;
        statusText = 'Complété';
        break;
      case 'cancelled':
        statusColor = AppColors.error;
        statusIcon = Icons.cancel;
        statusText = 'Annulé';
        break;
      default:
        statusColor = AppColors.info;
        statusIcon = Icons.schedule;
        statusText = 'Programmé';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isToday ? const Color(0xFF3B760F) : Colors.grey.shade200,
          width: isToday ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icône de calendrier
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: isToday 
                  ? const Color(0xFF3B760F).withOpacity(0.12)
                  : AppColors.info.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isToday ? Icons.event_available : Icons.calendar_today,
              color: isToday ? const Color(0xFF3B760F) : AppColors.info,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          // Informations du rendez-vous
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  vaccineName,
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF0A1A33),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (dose != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Dose ${dose.toString()}',
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      Icons.access_time,
                      size: 14,
                      color: Colors.grey[600],
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        '$dateLabel$timeLabel',
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          color: Colors.grey[600],
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                if (appointment['administeredBy'] != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(
                        Icons.person,
                        size: 14,
                        color: Colors.blue[700],
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          'Agent : ${appointment['administeredBy'] ?? ''}',
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: Colors.blue[700],
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Badge de statut
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  statusIcon,
                  size: 14,
                  color: statusColor,
                ),
                const SizedBox(width: 4),
                Text(
                  statusText,
                  style: GoogleFonts.poppins(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 🔌 Connexion Socket.io pour recevoir les notifications en temps réel
  void _connectToSocket() {
    try {
      final baseUrl = ApiConfig.socketUrl;
      
      _socket = IO.io(
        baseUrl,
        IO.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .setTimeout(5000)
            .build(),
      );

      _socket!.connect();

      _socket!.on('connect', (_) {
        final child = _dashboardData?["child"] as Map<String, dynamic>?;
        final parentPhone = child?["parentPhone"] as String?;
        
        _socket!.emit('join', {'room': widget.childId});
        _socket!.emit('join', {'room': 'all'});
        
        if (parentPhone != null) {
          _socket!.emit('join', {
            'room': 'parent',
            'phone': parentPhone,
          });
        }
      });

      _socket!.off('newNotification');
      _socket!.on('newNotification', (data) async {
        try {
          if (data is Map && data['title'] != null) {
            final targetChildId = data['childId']?.toString();
            if (targetChildId != null && targetChildId != widget.childId) {
              return;
            }

            await _refreshNotificationCount();

            try {
              await _playNotificationSound();
            } catch (e) {
              // Ignorer les erreurs de son
            }

            if (mounted && context.mounted) {
              try {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Row(
                      children: [
                        const Icon(Icons.notifications_active, color: Colors.white),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                data['title'] ?? 'Notification',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              if (data['message'] != null)
                                Text(
                                  data['message'],
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    backgroundColor: const Color(0xFF3B760F),
                    duration: const Duration(seconds: 4),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              } catch (e) {
                // Ignorer les erreurs d'affichage
              }
            }

            if (data['type'] == 'vaccination' || data['type'] == 'campaign') {
              try {
                _loadDashboardData();
              } catch (e) {
                // Ignorer les erreurs de rechargement
              }
            }
          }
        } catch (e) {
          // Ignorer les erreurs silencieusement
        }
      });

      _socket!.on('reconnect', (_) {
        if (_dashboardData != null) {
          final child = _dashboardData?["child"] as Map<String, dynamic>?;
          final parentPhone = child?["parentPhone"] as String?;
          _socket!.emit('join', {'room': widget.childId});
          _socket!.emit('join', {'room': 'all'});
          if (parentPhone != null) {
            _socket!.emit('join', {'room': 'parent', 'phone': parentPhone});
          }
        }
      });
    } catch (e) {
      // Ignorer les erreurs de connexion silencieusement
    }
  }

  /// 🔊 Jouer le son de notification
  Future<void> _playNotificationSound() async {
    try {
      final player = FlutterRingtonePlayer();
      await player.playNotification();
    } catch (e) {
      // Ignorer les erreurs silencieusement
    }
  }

  /// 📱 Bottom Navigation Bar
  Widget _buildBottomNav() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(
                icon: Icons.home_rounded,
                label: 'Accueil',
                index: 0,
              ),
              _buildNavItem(
                icon: Icons.vaccines_outlined,
                label: 'Vaccins',
                index: 1,
              ),
              _buildNavItem(
                icon: Icons.calendar_today_outlined,
                label: 'Calendrier',
                index: 2,
              ),
              _buildNavItem(
                icon: Icons.person_outline_rounded,
                label: 'Profil',
                index: 3,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required int index,
  }) {
    final isActive = _currentIndex == index;

    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primary.withOpacity(0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isActive ? AppColors.primary : AppColors.textTertiary,
              size: 24,
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              label,
              style: AppTextStyles.caption.copyWith(
                color: isActive ? AppColors.primary : AppColors.textTertiary,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
