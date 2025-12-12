import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

import '../../core/config/api_config.dart';
import '../child/child_dashboard_screen.dart';
import 'vaccination_proof_upload_screen.dart';

class VaccinationDateScreen extends StatefulWidget {
  final List<Map<String, dynamic>> selectedVaccines;
  final String childId;
  final String token;
  final Map<String, dynamic> userData;

  const VaccinationDateScreen({
    super.key,
    required this.selectedVaccines,
    required this.childId,
    required this.token,
    required this.userData,
  });

  @override
  State<VaccinationDateScreen> createState() => _VaccinationDateScreenState();
}

class _VaccinationDateScreenState extends State<VaccinationDateScreen> {
  final DateFormat _dateFormat = DateFormat('dd MMM yyyy', 'fr_FR');
  final Map<String, DateTime?> _dateSelections = {};
  List<Map<String, dynamic>>? _resolvedSelection;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _hydrateSelection(widget.selectedVaccines, shouldNotify: false);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_resolvedSelection != null && _resolvedSelection!.isNotEmpty) {
      return;
    }

    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is List<Map<String, dynamic>>) {
      _hydrateSelection(args);
    } else if (args is List) {
      final parsed = args
          .whereType<Map>()
          .map((entry) =>
              Map<String, dynamic>.from(entry.cast<String, dynamic>()))
          .toList();
      _hydrateSelection(parsed);
    }

    _resolvedSelection ??= [];
  }

  void _hydrateSelection(
    List<Map<String, dynamic>> source, {
    bool shouldNotify = true,
  }) {
    if (source.isEmpty) {
      return;
    }

    _resolvedSelection =
        source.map((entry) => Map<String, dynamic>.from(entry)).toList();

    for (final entry in _resolvedSelection!) {
      final key = _buildEntryKey(entry);
      _dateSelections.putIfAbsent(key, () => null);
    }
    if (shouldNotify && mounted) {
      setState(() {});
    }
  }

  List<Map<String, dynamic>> get _selectedEntries =>
      _resolvedSelection ?? const [];

  String _buildEntryKey(Map<String, dynamic> entry) {
    final calendarId = entry['vaccineCalendarId'] ?? "none";
    return "${entry['vaccineId']}::${entry['dose']}::$calendarId";
  }

  bool get _allDatesSelected =>
      _dateSelections.values.every((date) => date != null);

  Map<String, List<Map<String, dynamic>>> get _groupedVaccines {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final entry in _selectedEntries) {
      final vaccineName = entry['vaccineName'] as String? ?? "Vaccin";
      grouped.putIfAbsent(vaccineName, () => []).add(entry);
    }
    return grouped;
  }

  Future<void> _pickDate(String entryKey) async {
    final initialDate = _dateSelections[entryKey] ?? DateTime.now();
    final firstDate = DateTime.now().subtract(const Duration(days: 3650));
    final lastDate = DateTime.now();

    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
      locale: const Locale('fr', 'FR'),
    );

    if (picked != null && mounted) {
      setState(() {
        _dateSelections[entryKey] = picked;
      });
    }
  }

  Future<void> _submitDates() async {
    if (_selectedEntries.isEmpty) {
      setState(() {
        _error = "Aucun vaccin sélectionné. Retournez à l'étape précédente.";
      });
      return;
    }

    if (!_allDatesSelected) {
      setState(() {
        _error = "Merci de renseigner la date de chaque dose sélectionnée.";
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
    final payload = _selectedEntries.map((entry) {
        final key = _buildEntryKey(entry);
        final date = _dateSelections[key]!;
        return {
          "vaccineId": entry["vaccineId"],
          "vaccineCalendarId": entry["vaccineCalendarId"],
          "dose": entry["dose"],
          "administeredAt": date.toUtc().toIso8601String(),
        };
      }).toList();

      final endpoint = Uri.parse(
        "${ApiConfig.apiBaseUrl}/mobile/children/${widget.childId}/mark-vaccines-done",
      );

      final response = await http.post(
        endpoint,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer ${widget.token}",
        },
        body: jsonEncode({"vaccines": payload}),
      );

      if (!mounted) return;

      if (response.statusCode == 200 || response.statusCode == 201) {
        final responseData = jsonDecode(response.body);
        final isActive = responseData['isActive'] ?? false;
        final needsVerification = responseData['needsVerification'] ?? false;

        // Si le compte est activé (aucun vaccin sélectionné), aller directement au dashboard
        if (isActive && !needsVerification) {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(
              builder: (_) => ChildDashboardScreen(
                userData: widget.userData,
                childId: widget.childId,
              ),
            ),
            (route) => false,
          );
          return;
        }

        // Si des vaccins ont été sélectionnés, aller à la page d'upload de photos
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => VaccinationProofUploadScreen(
              childId: widget.childId,
              token: widget.token,
              userData: widget.userData,
            ),
          ),
        );
      } else {
        final data = jsonDecode(response.body);
        setState(() {
          _error = data["message"] ?? "Impossible d'enregistrer les vaccins.";
          _isSubmitting = false;
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = "Erreur de connexion au serveur.";
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _groupedVaccines;
    final isLoadingSelection = _resolvedSelection == null;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Dates de vaccination",
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF3B760F).withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              "Pour chaque vaccin sélectionné, indiquez la date exacte à laquelle il a été administré.",
              style: GoogleFonts.poppins(
                fontSize: 13,
                color: const Color(0xFF0A1A33),
                height: 1.5,
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: GoogleFonts.poppins(
                        color: Colors.red,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Expanded(
            child: isLoadingSelection
                ? const Center(
                    child: CircularProgressIndicator(),
                  )
                : _selectedEntries.isEmpty
                    ? Center(
                        child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.vaccines_outlined,
                            size: 48,
                            color: Color(0xFF64748B),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            "Aucun vaccin sélectionné.",
                            style: GoogleFonts.poppins(
                              fontSize: 15,
                              color: const Color(0xFF0A1A33),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            "Retournez à l'étape précédente pour choisir les vaccins effectués.",
                            style: GoogleFonts.poppins(
                              fontSize: 13,
                              color: const Color(0xFF64748B),
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 16),
                          OutlinedButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: Text(
                              "Revenir au choix",
                              style: GoogleFonts.poppins(),
                            ),
                          ),
                        ],
                      )
                      )
                    : ListView(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        children: grouped.entries.map((group) {
                          final vaccineName = group.key;
                          final doses = group.value
                            ..sort(
                              (a, b) =>
                                  (a['dose'] as int).compareTo(b['dose'] as int),
                            );

                          return Card(
                            margin: const EdgeInsets.only(bottom: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: const BorderSide(
                                color: Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: 12,
                                horizontal: 16,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    vaccineName,
                                    style: GoogleFonts.poppins(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFF0A1A33),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    "${doses.length} dose(s) à renseigner",
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  ...doses.map((doseEntry) {
                                    final entryKey = _buildEntryKey(doseEntry);
                                    final selectedDate =
                                        _dateSelections[entryKey];
                                    final doseNumber = doseEntry['dose'] as int;
                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 12,
                                        horizontal: 12,
                                      ),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: const Color(0xFFE2E8F0),
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  "Dose $doseNumber",
                                                  style: GoogleFonts.poppins(
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  selectedDate == null
                                                      ? "Aucune date sélectionnée"
                                                      : _dateFormat.format(
                                                          selectedDate,
                                                        ),
                                                  style: GoogleFonts.poppins(
                                                    color: selectedDate == null
                                                        ? const Color(0xFF94A3B8)
                                                        : const Color(0xFF0A1A33),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                    SizedBox(
                                      width: 120,
                                      child: OutlinedButton(
                                        onPressed: _isSubmitting
                                            ? null
                                            : () => _pickDate(entryKey),
                                        child: Text(
                                          selectedDate == null
                                              ? "Choisir"
                                              : "Modifier",
                                          style: GoogleFonts.poppins(),
                                        ),
                                      ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitDates,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B760F),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.5,
                        ),
                      )
                    : Text(
                        "Enregistrer les dates",
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

