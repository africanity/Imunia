import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../child/child_dashboard_screen.dart';

class ChildSelectionScreen extends StatefulWidget {
  final List<Map<String, dynamic>> children;
  final String token;

  const ChildSelectionScreen({
    super.key,
    required this.children,
    required this.token,
  });

  @override
  State<ChildSelectionScreen> createState() => _ChildSelectionScreenState();
}

class _ChildSelectionScreenState extends State<ChildSelectionScreen> {
  final storage = const FlutterSecureStorage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0A1A33)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          "Sélectionner un enfant",
          style: GoogleFonts.poppins(
            color: const Color(0xFF0A1A33),
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Plusieurs enfants sont associés à ce numéro",
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF0A1A33),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "Sélectionnez l'enfant pour lequel vous souhaitez vous connecter",
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 32),
              Expanded(
                child: ListView.builder(
                  itemCount: widget.children.length,
                  itemBuilder: (context, index) {
                    final child = widget.children[index];
                    return _buildChildCard(child);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChildCard(Map<String, dynamic> child) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0A1A33).withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () async {
            // Naviguer vers l'interface enfant
            final childId = child['id'] ?? child['_id'] ?? '';
            // Stocker les informations pour la restauration de session
            await storage.write(key: 'child_id', value: childId.toString());
            final parentPhone = child['parentPhone'] as String?;
            if (parentPhone != null) {
              await storage.write(key: 'parent_phone', value: parentPhone);
            }
            
            if (!mounted) return;
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => ChildDashboardScreen(
                  userData: child,
                  childId: childId.toString(),
                ),
              ),
            );
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                // Avatar
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: const Color(0xFF3B760F).withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    child['gender'] == 'M' ? Icons.boy : Icons.girl,
                    color: const Color(0xFF3B760F),
                    size: 32,
                  ),
                ),
                const SizedBox(width: 16),
                // Informations
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "${child['firstName'] ?? ''} ${child['lastName'] ?? ''}",
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF0A1A33),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "Né(e) le ${_formatDate(child['birthDate'])}",
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.arrow_forward_ios,
                  color: Color(0xFF64748B),
                  size: 18,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatDate(dynamic date) {
    if (date == null) return "Date inconnue";
    try {
      final dateTime = date is String ? DateTime.parse(date) : date as DateTime;
      return "${dateTime.day}/${dateTime.month}/${dateTime.year}";
    } catch (e) {
      return "Date inconnue";
    }
  }
}

