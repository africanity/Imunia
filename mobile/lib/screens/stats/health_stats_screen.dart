import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../services/api_service.dart';
import '../../core/theme/app_colors.dart';

class HealthStatsScreen extends StatefulWidget {
  final Map<String, dynamic> child;

  const HealthStatsScreen({super.key, required this.child});

  @override
  State<HealthStatsScreen> createState() => _HealthStatsScreenState();
}

class _HealthStatsScreenState extends State<HealthStatsScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _stats;

  // Couleurs pour le graphique (similaires au dashboard admin)
  static const List<Color> _chartColors = [
    Color(0xFF10B981), // Vert - Complétés
    Color(0xFF3B82F6), // Bleu - À faire
    Color(0xFFF59E0B), // Orange - En retard
    Color(0xFFEF4444), // Rouge - Ratés
  ];

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final childId = widget.child['id'] ?? widget.child['_id'] ?? '';
      final stats = await ApiService.getVaccinationStats(childId);
      setState(() {
        _stats = stats['stats'] as Map<String, dynamic>?;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  List<PieChartSectionData> _getPieChartSections() {
    if (_stats == null) return [];

    final completed = _stats!['totalCompleted'] ?? 0;
    final due = _stats!['totalDue'] ?? 0;
    final late = _stats!['totalLate'] ?? 0;
    final overdue = _stats!['totalOverdue'] ?? 0;

    final total = completed + due + late + overdue;
    if (total == 0) return [];

    final sections = <PieChartSectionData>[];

    if (completed > 0) {
      sections.add(
        PieChartSectionData(
          value: completed.toDouble(),
          color: _chartColors[0],
          title: '${((completed / total) * 100).toStringAsFixed(0)}%',
          radius: 80,
          titleStyle: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      );
    }

    if (due > 0) {
      sections.add(
        PieChartSectionData(
          value: due.toDouble(),
          color: _chartColors[1],
          title: '${((due / total) * 100).toStringAsFixed(0)}%',
          radius: 80,
          titleStyle: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      );
    }

    if (late > 0) {
      sections.add(
        PieChartSectionData(
          value: late.toDouble(),
          color: _chartColors[2],
          title: '${((late / total) * 100).toStringAsFixed(0)}%',
          radius: 80,
          titleStyle: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      );
    }

    if (overdue > 0) {
      sections.add(
        PieChartSectionData(
          value: overdue.toDouble(),
          color: _chartColors[3],
          title: '${((overdue / total) * 100).toStringAsFixed(0)}%',
          radius: 80,
          titleStyle: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      );
    }

    return sections;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
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
          'Statistiques de vaccination',
          style: GoogleFonts.poppins(
            color: const Color(0xFF0A1A33),
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
        iconTheme: const IconThemeData(color: Color(0xFF0A1A33)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF3B760F)))
          : _stats == null
              ? Center(
                  child: Text(
                    'Aucune statistique disponible',
                    style: GoogleFonts.poppins(color: Colors.grey),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadStats,
                  color: const Color(0xFF3B760F),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Graphique en camembert
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.04),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              Text(
                                'Répartition des vaccinations',
                                style: GoogleFonts.poppins(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF0A1A33),
                                ),
                              ),
                              const SizedBox(height: 24),
                              SizedBox(
                                height: 250,
                                child: PieChart(
                                  PieChartData(
                                    sections: _getPieChartSections(),
                                    sectionsSpace: 2,
                                    centerSpaceRadius: 60,
                                    startDegreeOffset: -90,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 24),
                              // Légende
                              Wrap(
                                spacing: 16,
                                runSpacing: 12,
                                alignment: WrapAlignment.center,
                                children: [
                                  _buildLegendItem(
                                    'Complétés',
                                    _chartColors[0],
                                    _stats!['totalCompleted'] ?? 0,
                                  ),
                                  _buildLegendItem(
                                    'À faire',
                                    _chartColors[1],
                                    _stats!['totalDue'] ?? 0,
                                  ),
                                  _buildLegendItem(
                                    'En retard',
                                    _chartColors[2],
                                    _stats!['totalLate'] ?? 0,
                                  ),
                                  _buildLegendItem(
                                    'Ratés',
                                    _chartColors[3],
                                    _stats!['totalOverdue'] ?? 0,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        // Cartes de statistiques détaillées
                        _buildStatCard(
                          'Vaccins complétés',
                          '${_stats!['totalCompleted'] ?? 0}',
                          Icons.check_circle_outline,
                          _chartColors[0],
                        ),
                        const SizedBox(height: 12),
                        _buildStatCard(
                          'Vaccins à faire',
                          '${_stats!['totalDue'] ?? 0}',
                          Icons.pending_outlined,
                          _chartColors[1],
                        ),
                        const SizedBox(height: 12),
                        _buildStatCard(
                          'Vaccins en retard',
                          '${_stats!['totalLate'] ?? 0}',
                          Icons.schedule_outlined,
                          _chartColors[2],
                        ),
                        const SizedBox(height: 12),
                        _buildStatCard(
                          'Vaccins ratés',
                          '${_stats!['totalOverdue'] ?? 0}',
                          Icons.error_outline_rounded,
                          _chartColors[3],
                        ),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildLegendItem(String label, Color color, int value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '$label ($value)',
          style: GoogleFonts.poppins(
            fontSize: 12,
            color: const Color(0xFF64748B),
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.poppins(
                    fontSize: 14,
                    color: const Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: GoogleFonts.poppins(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
