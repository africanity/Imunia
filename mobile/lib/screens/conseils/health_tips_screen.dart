import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/api_service.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

class HealthTipsScreen extends StatefulWidget {
  const HealthTipsScreen({super.key});

  @override
  State<HealthTipsScreen> createState() => _HealthTipsScreenState();
}

class _HealthTipsScreenState extends State<HealthTipsScreen> {
  String _selectedCategory = 'all';
  bool _isLoading = true;
  List<Map<String, dynamic>> _healthTips = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadHealthTips();
  }

  Future<void> _loadHealthTips() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final data = await ApiService.getHealthTips();
      setState(() {
        _healthTips = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filteredTips {
    if (_selectedCategory == 'all') return _healthTips;
    return _healthTips.where((tip) => tip['category'] == _selectedCategory).toList();
  }

  IconData _getCategoryIcon(String? category) {
    switch (category) {
      case 'vaccination':
        return Icons.vaccines_outlined;
      case 'nutrition':
        return Icons.restaurant_outlined;
      case 'hygiene':
        return Icons.wash_outlined;
      case 'development':
        return Icons.child_care_outlined;
      case 'safety':
        return Icons.shield_outlined;
      default:
        return Icons.lightbulb_outline_rounded;
    }
  }

  Color _getCategoryColor(String? category) {
    switch (category) {
      case 'vaccination':
        return AppColors.info;
      case 'nutrition':
        return AppColors.success;
      case 'hygiene':
        return AppColors.secondary;
      case 'development':
        return AppColors.warning;
      case 'safety':
        return AppColors.error;
      default:
        return AppColors.primary;
    }
  }

  String _getCategoryLabel(String? category) {
    switch (category) {
      case 'vaccination':
        return 'Vaccination';
      case 'nutrition':
        return 'Nutrition';
      case 'hygiene':
        return 'Hygiène';
      case 'development':
        return 'Développement';
      case 'safety':
        return 'Sécurité';
      default:
        return 'Général';
    }
  }

  String _getAgeLabel(Map<String, dynamic> tip) {
    if (tip['specificAge'] != null && tip['ageUnit'] != null) {
      final unit = tip['ageUnit'] == 'WEEKS' ? 'semaines' : 
                   tip['ageUnit'] == 'MONTHS' ? 'mois' : 'ans';
      return '${tip['specificAge']} $unit';
    }
    if (tip['minAge'] != null && tip['maxAge'] != null && tip['ageUnit'] != null) {
      final unit = tip['ageUnit'] == 'WEEKS' ? 'semaines' : 
                   tip['ageUnit'] == 'MONTHS' ? 'mois' : 'ans';
      return '${tip['minAge']}-${tip['maxAge']} $unit';
    }
    return 'Tous les âges';
  }

  Widget _buildTipCard(Map<String, dynamic> tip) {
    final category = tip['category'];
    final color = _getCategoryColor(category);
    final icon = _getCategoryIcon(category);

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: AppColors.border, width: 1),
      ),
      child: InkWell(
        onTap: () => _showTipDetails(tip),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
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
                    child: Icon(icon, color: color, size: 24),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (category != null)
                          Text(
                            _getCategoryLabel(category),
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: color,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        const SizedBox(height: 2),
                        Text(
                          _getAgeLabel(tip),
                          style: GoogleFonts.poppins(
                            fontSize: 11,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                tip['title'] ?? 'Conseil',
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF0A1A33),
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                tip['content'] ?? '',
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  color: const Color(0xFF64748B),
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showTipDetails(Map<String, dynamic> tip) {
    final category = tip['category'];
    final color = _getCategoryColor(category);
    final icon = _getCategoryIcon(category);

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
            Container(
              margin: const EdgeInsets.symmetric(vertical: AppSpacing.md),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(AppRadius.full),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: color.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(AppRadius.lg),
                          ),
                          child: Icon(icon, color: color, size: 32),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (category != null)
                                Text(
                                  _getCategoryLabel(category),
                                  style: GoogleFonts.poppins(
                                    fontSize: 14,
                                    color: color,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              const SizedBox(height: 4),
                              Text(
                                _getAgeLabel(tip),
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
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      tip['title'] ?? 'Conseil',
                      style: GoogleFonts.poppins(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0A1A33),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      tip['content'] ?? '',
                      style: GoogleFonts.poppins(
                        fontSize: 14,
                        color: const Color(0xFF64748B),
                        height: 1.6,
                      ),
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

  @override
Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Conseils de santé'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0A1A33)),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(50),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildCategoryChip('all', 'Tous'),
                  const SizedBox(width: AppSpacing.sm),
                  _buildCategoryChip('vaccination', 'Vaccination'),
                  const SizedBox(width: AppSpacing.sm),
                  _buildCategoryChip('nutrition', 'Nutrition'),
                  const SizedBox(width: AppSpacing.sm),
                  _buildCategoryChip('hygiene', 'Hygiène'),
                  const SizedBox(width: AppSpacing.sm),
                  _buildCategoryChip('development', 'Développement'),
                  const SizedBox(width: AppSpacing.sm),
                  _buildCategoryChip('safety', 'Sécurité'),
                ],
              ),
            ),
          ),
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
                        onPressed: _loadHealthTips,
                        child: const Text('Réessayer'),
                      ),
                    ],
                  ),
                )
              : _filteredTips.isEmpty
                  ? EmptyState(
                      icon: Icons.lightbulb_outline,
                      title: 'Aucun conseil',
                      message: _selectedCategory == 'all'
                          ? 'Aucun conseil disponible'
                          : 'Aucun conseil dans cette catégorie',
                    )
                  : RefreshIndicator(
                      onRefresh: _loadHealthTips,
                      color: AppColors.primary,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        itemCount: _filteredTips.length,
                        itemBuilder: (context, index) {
                          return _buildTipCard(_filteredTips[index]);
                        },
                      ),
                    ),
    );
  }

  Widget _buildCategoryChip(String category, String label) {
    final isSelected = _selectedCategory == category;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedCategory = category;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.full),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF0A1A33),
          ),
        ),
      ),
    );
  }
}
