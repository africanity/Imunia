import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

class CampagneScreen extends StatefulWidget {
  const CampagneScreen({super.key});

  @override
  State<CampagneScreen> createState() => _CampagneScreenState();
}

class _CampagneScreenState extends State<CampagneScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  List<Map<String, dynamic>> _campaigns = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadCampaigns();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadCampaigns() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final data = await ApiService.getCampaigns();
      setState(() {
        _campaigns = data;
        // Trier par date de début (plus récente en premier)
        _campaigns.sort((a, b) {
          final dateA = DateTime.tryParse(a['startDate'] ?? '');
          final dateB = DateTime.tryParse(b['startDate'] ?? '');
          if (dateA == null || dateB == null) return 0;
          return dateB.compareTo(dateA);
        });
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  String _getCampaignStatus(Map<String, dynamic> campaign) {
    final now = DateTime.now();
    final startDate = DateTime.tryParse(campaign['startDate'] ?? '');
    final endDate = DateTime.tryParse(campaign['endDate'] ?? '');

    if (startDate == null || endDate == null) return 'planned';

    if (now.isBefore(startDate)) {
      return 'upcoming';
    } else if (now.isAfter(endDate)) {
      return 'completed';
    } else {
      return 'ongoing';
    }
  }

  bool _isUpcoming(Map<String, dynamic> campaign) {
    final startDate = DateTime.tryParse(campaign['startDate'] ?? '');
    if (startDate == null) return false;
    return DateTime.now().isBefore(startDate);
  }

  bool _isCompleted(Map<String, dynamic> campaign) {
    final endDate = DateTime.tryParse(campaign['endDate'] ?? '');
    if (endDate == null) return false;
    return DateTime.now().isAfter(endDate);
  }

  List<Map<String, dynamic>> _filterCampaigns(String filter) {
    switch (filter) {
      case 'all':
        return _campaigns;
      case 'ongoing':
        return _campaigns.where((c) => _getCampaignStatus(c) == 'ongoing').toList();
      case 'upcoming':
        return _campaigns.where((c) => _isUpcoming(c)).toList();
      case 'completed':
        return _campaigns.where((c) => _isCompleted(c)).toList();
      default:
        return _campaigns;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'ongoing':
        return AppColors.success;
      case 'completed':
        return AppColors.textSecondary;
      case 'cancelled':
        return AppColors.error;
      case 'upcoming':
      case 'planned':
      default:
        return AppColors.primary;
    }
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'ongoing':
        return 'En cours';
      case 'completed':
        return 'Terminée';
      case 'cancelled':
        return 'Annulée';
      case 'upcoming':
        return 'À venir';
      case 'planned':
      default:
        return 'Planifiée';
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'ongoing':
        return Icons.play_circle_filled;
      case 'completed':
        return Icons.check_circle;
      case 'cancelled':
        return Icons.cancel;
      case 'upcoming':
        return Icons.event;
      case 'planned':
      default:
        return Icons.event;
    }
  }

  Widget _buildTabContent(String filter) {
    final filtered = _filterCampaigns(filter);

    if (filtered.isEmpty) {
      return EmptyState(
        icon: Icons.campaign_outlined,
        title: 'Aucune campagne',
        message: filter == 'all'
            ? 'Aucune campagne de vaccination disponible'
            : 'Aucune campagne avec ce statut',
      );
    }

    return RefreshIndicator(
      onRefresh: _loadCampaigns,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: filtered.length,
        itemBuilder: (context, index) {
          final campaign = filtered[index];
          return _buildCampaignCard(campaign);
        },
      ),
    );
  }

  Widget _buildCampaignCard(Map<String, dynamic> campaign) {
    final status = _getCampaignStatus(campaign);
    final statusColor = _getStatusColor(status);
    final dateFormat = DateFormat('dd MMM yyyy', 'fr_FR');
    final startDate = DateTime.tryParse(campaign['startDate'] ?? '');
    final endDate = DateTime.tryParse(campaign['endDate'] ?? '');

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: AppColors.border, width: 1),
      ),
      child: InkWell(
        onTap: () => _showCampaignDetails(campaign),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // En-tête : Titre et statut
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Icône de campagne
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Icon(
                      Icons.campaign_rounded,
                      color: statusColor,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  // Titre et région
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          campaign['title'] ?? 'Campagne',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF0A1A33),
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (campaign['region'] != null && campaign['region']['name'] != null) ...[
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(
                                Icons.location_on_outlined,
                                size: 14,
                                color: Color(0xFF64748B),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                campaign['region']['name'],
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  // Badge de statut
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(_getStatusIcon(status), size: 14, color: statusColor),
                        const SizedBox(width: 4),
                        Text(
                          _getStatusLabel(status),
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: statusColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              // Dates
              if (startDate != null && endDate != null)
                Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_outlined,
                      size: 16,
                      color: Color(0xFF64748B),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${dateFormat.format(startDate)} - ${dateFormat.format(endDate)}',
                      style: GoogleFonts.poppins(
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              // Description
              if (campaign['description'] != null && campaign['description'].toString().isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  campaign['description'],
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: const Color(0xFF64748B),
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showCampaignDetails(Map<String, dynamic> campaign) {
    final dateFormat = DateFormat('dd MMMM yyyy', 'fr_FR');
    final startDate = DateTime.tryParse(campaign['startDate'] ?? '');
    final endDate = DateTime.tryParse(campaign['endDate'] ?? '');
    final status = _getCampaignStatus(campaign);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.75,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(AppRadius.xl),
            topRight: Radius.circular(AppRadius.xl),
          ),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(AppRadius.full),
              ),
            ),
            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // En-tête
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(AppRadius.lg),
                          ),
                          child: Icon(
                            Icons.campaign_rounded,
                            color: AppColors.primary,
                            size: 32,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                campaign['title'] ?? 'Campagne',
                                style: GoogleFonts.poppins(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF0A1A33),
                                ),
                              ),
                              if (campaign['region'] != null && campaign['region']['name'] != null) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.location_on_outlined,
                                      size: 16,
                                      color: Color(0xFF64748B),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      campaign['region']['name'],
                                      style: GoogleFonts.poppins(
                                        fontSize: 14,
                                        color: const Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    // Description
                    if (campaign['description'] != null && campaign['description'].toString().isNotEmpty) ...[
                      Text(
                        'Description',
                        style: GoogleFonts.poppins(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        campaign['description'],
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                    ],
                    // Informations
                    Text(
                      'Informations',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (startDate != null)
                      _buildInfoRow(
                        Icons.calendar_today_outlined,
                        'Date de début',
                        dateFormat.format(startDate),
                      ),
                    if (endDate != null)
                      _buildInfoRow(
                        Icons.event_outlined,
                        'Date de fin',
                        dateFormat.format(endDate),
                      ),
                    _buildInfoRow(
                      Icons.info_outline,
                      'Statut',
                      _getStatusLabel(status),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        children: [
          Icon(icon, size: 20, color: const Color(0xFF64748B)),
          const SizedBox(width: AppSpacing.sm),
          Text(
            '$label: ',
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: const Color(0xFF64748B),
            ),
          ),
          Text(
            value,
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF0A1A33),
            ),
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
        title: const Text('Campagnes'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0A1A33)),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textTertiary,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Toutes'),
            Tab(text: 'En cours'),
            Tab(text: 'À venir'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 64, color: AppColors.error),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Erreur de chargement',
                        style: GoogleFonts.poppins(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        _error!,
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      ElevatedButton(
                        onPressed: _loadCampaigns,
                        child: const Text('Réessayer'),
                      ),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildTabContent('all'),
                    _buildTabContent('ongoing'),
                    _buildTabContent('upcoming'),
                  ],
                ),
    );
  }
}
