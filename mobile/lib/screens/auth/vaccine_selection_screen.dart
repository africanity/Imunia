import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../child/child_dashboard_screen.dart';
import '../../core/config/api_config.dart';
import 'vaccination_date_screen.dart';

class VaccineSelectionScreen extends StatefulWidget {
  final String childId;
  final DateTime childBirthDate;
  final String token;
  final Map<String, dynamic> userData;

  const VaccineSelectionScreen({
    super.key,
    required this.childId,
    required this.childBirthDate,
    required this.token,
    required this.userData,
  });

  @override
  State<VaccineSelectionScreen> createState() => _VaccineSelectionScreenState();
}

class _VaccineSelectionScreenState extends State<VaccineSelectionScreen> {
  final storage = const FlutterSecureStorage();
  List<Map<String, dynamic>> _availableVaccines = []; // Liste de vaccins individuels
  Map<String, int> _selectedVaccinesWithDoses = {}; // Format: "vaccineId" -> nombre total de doses sélectionnées
  final Map<String, List<Map<String, dynamic>>> _doseTimelineByVaccine = {};
  final Map<String, List<String>> _calendarWindowsByVaccine = {};
  bool _isLoading = true;
  String? _error;

  List<Map<String, dynamic>> _cloneTimeline(dynamic raw) {
    if (raw is List) {
      return raw
          .whereType<Map>()
          .map(
            (entry) =>
                Map<String, dynamic>.from(entry.cast<String, dynamic>()),
          )
          .toList();
    }
    return const [];
  }

  int _parsePositiveInt(dynamic value, [int fallback = 0]) {
    final parsed =
        value is num ? value.toInt() : int.tryParse(value?.toString() ?? '');
    if (parsed == null || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  List<Map<String, dynamic>> _buildFallbackTimeline(
    String vaccineId,
    Map<String, dynamic> aggregatedData,
  ) {
    final windows = _calendarWindowsByVaccine[vaccineId] ?? const [];
    if (windows.isEmpty) {
      return const [];
    }

    final totalDoses =
        _parsePositiveInt(aggregatedData['rawDosesRequired'], windows.length);
    if (totalDoses <= 0) {
      return const [];
    }

    final assignments = <Map<String, dynamic>>[];
    int doseNumber = 1;
    int windowIndex = 0;

    while (doseNumber <= totalDoses) {
      final calendarId = windows[windowIndex];
      assignments.add({
        'calendarId': calendarId,
        'doseNumber': doseNumber,
      });
      doseNumber += 1;
      if (windows.length > 1 && windowIndex < windows.length - 1) {
        windowIndex += 1;
      }
    }

    return assignments;
  }

  @override
  void initState() {
    super.initState();
    _loadVaccineCalendar();
  }

  int _getChildAgeInMonths() {
    final now = DateTime.now();
    final difference = now.difference(widget.childBirthDate);
    return (difference.inDays / 30.44).floor();
  }


  Future<void> _loadVaccineCalendar() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final ageInMonths = _getChildAgeInMonths();
      
      final uri = Uri.parse("${ApiConfig.apiBaseUrl}/mobile/vaccine-calendar");
      final url = uri.replace(queryParameters: {
        "childId": widget.childId,
      });
      final response = await http.get(
        url,
        headers: {
          "Authorization": "Bearer ${widget.token}",
        },
      );

      if (response.statusCode == 200) {
        final List<dynamic> allCalendar = jsonDecode(response.body);

        // Filtrer les vaccins qui sont pertinents pour l'enfant :
        // 1. Les vaccins dans la plage d'âge actuelle (minAge <= age <= maxAge)
        // 2. Les vaccins recommandés AVANT l'âge actuel (maxAge < age) pour savoir s'ils ont été faits
        final relevantVaccines = allCalendar.where((entry) {
          final ageUnit = entry['ageUnit'] as String;
          final minAge = entry['minAge'] as int?;
          final maxAge = entry['maxAge'] as int?;
          
          // Convertir l'âge de l'enfant dans l'unité du calendrier
          double childAgeInCalendarUnit = 0;
          if (ageUnit == 'MONTHS') {
            childAgeInCalendarUnit = ageInMonths.toDouble();
          } else if (ageUnit == 'WEEKS') {
            childAgeInCalendarUnit = (ageInMonths * 4.33);
          } else if (ageUnit == 'YEARS') {
            childAgeInCalendarUnit = (ageInMonths / 12.0);
          }
          
          // Inclure le vaccin si :
          // - L'enfant est dans la plage d'âge (minAge <= age <= maxAge), OU
          // - Le vaccin est recommandé avant l'âge actuel (maxAge < age) pour vérifier s'il a été fait
          final isInCurrentRange = (minAge == null || childAgeInCalendarUnit >= minAge) &&
                                    (maxAge == null || childAgeInCalendarUnit <= maxAge);
          
          final isPastRange = maxAge != null && childAgeInCalendarUnit > maxAge;
          
          return isInCurrentRange || isPastRange;
        }).toList();

        double? normalizeAgeToDays(dynamic value, String? unit) {
          if (value == null) return null;
          final numeric = value is num ? value.toDouble() : double.tryParse(value.toString());
          if (numeric == null) return null;
          switch (unit) {
            case 'WEEKS':
              return numeric * 7;
            case 'MONTHS':
              return numeric * 30.4375;
            case 'YEARS':
              return numeric * 365.25;
            default:
              return numeric;
          }
        }

        final Map<String, Map<String, dynamic>> aggregated = {};
        _calendarWindowsByVaccine.clear();

        for (final entry in relevantVaccines) {
          final vaccinesList = entry['vaccines'] as List? ?? [];
          final vaccineCalendarId = entry['id'] as String?;
          final ageUnit = entry['ageUnit'] as String?;
          final specificAge = entry['specificAge'];
          final minAge = entry['minAge'];
          final maxAge = entry['maxAge'];

          final windowWeight =
              normalizeAgeToDays(specificAge, ageUnit) ??
              normalizeAgeToDays(minAge, ageUnit) ??
              normalizeAgeToDays(maxAge, ageUnit) ??
              double.infinity;

          for (final v in vaccinesList) {
            if (v is! Map) continue;
            final vaccineId = v['id'];
            if (vaccineId is! String || vaccineId.isEmpty) continue;
            final vaccineName = v['name'] as String? ?? "Vaccin";
            if (vaccineCalendarId != null) {
              _calendarWindowsByVaccine
                  .putIfAbsent(vaccineId, () => [])
                  .add(vaccineCalendarId);
            }

            final entryData = aggregated.putIfAbsent(vaccineId, () {
              return {
                'vaccineId': vaccineId,
                'vaccineName': vaccineName,
                'primaryWeight': windowWeight,
                'primaryAgeUnit': ageUnit,
                'primarySpecificAge': specificAge,
                'primaryMinAge': minAge,
                'primaryMaxAge': maxAge,
                'rawDosesRequired': v['dosesRequired'],
                'doseTimeline': <Map<String, dynamic>>[],
                'maxDoseNumber': 0,
              };
            });

            if (windowWeight < (entryData['primaryWeight'] as double? ?? double.infinity)) {
              entryData['primaryWeight'] = windowWeight;
              entryData['primaryAgeUnit'] = ageUnit;
              entryData['primarySpecificAge'] = specificAge;
              entryData['primaryMinAge'] = minAge;
              entryData['primaryMaxAge'] = maxAge;
            }

            final List<dynamic> rawDoseNumbers = (v['doseNumbers'] as List<dynamic>?) ?? [];
            final List<int> doseNumbers = rawDoseNumbers
                .map((value) => value is num ? value.toInt() : int.tryParse(value.toString()))
                .whereType<int>()
                .toList()
              ..sort();

            if (doseNumbers.isNotEmpty) {
              for (final doseNumber in doseNumbers) {
                final currentMax = entryData['maxDoseNumber'] as int? ?? 0;
                if (doseNumber > currentMax) {
                  entryData['maxDoseNumber'] = doseNumber;
                }
                (entryData['doseTimeline'] as List<Map<String, dynamic>>).add({
                  'doseNumber': doseNumber,
                  'calendarId': vaccineCalendarId,
                });
              }
            } else {
              final rawDoseCount = v['doseCount'] ?? v['dosesRequired'];
              final fallbackCount = rawDoseCount is num
                  ? rawDoseCount.toInt()
                  : int.tryParse(rawDoseCount?.toString() ?? '0') ?? 0;
              if (fallbackCount > 0) {
                for (int i = 0; i < fallbackCount; i++) {
                  final currentMax = (entryData['maxDoseNumber'] as int? ?? 0) + 1;
                  entryData['maxDoseNumber'] = currentMax;
                  (entryData['doseTimeline'] as List<Map<String, dynamic>>).add({
                    'doseNumber': currentMax,
                    'calendarId': vaccineCalendarId,
                  });
                }
              }
            }
          }
        }

        _doseTimelineByVaccine.clear();

        final List<Map<String, dynamic>> individualVaccines =
            aggregated.values.map((data) {
          final List<Map<String, dynamic>> timeline =
              List<Map<String, dynamic>>.from(data['doseTimeline'] as List)
                ..sort((a, b) {
                  final aDose = a['doseNumber'] is num
                      ? (a['doseNumber'] as num).toInt()
                      : 0;
                  final bDose = b['doseNumber'] is num
                      ? (b['doseNumber'] as num).toInt()
                      : 0;
                  return aDose.compareTo(bDose);
                });
          List<Map<String, dynamic>> effectiveTimeline = timeline;
          if (effectiveTimeline.isEmpty) {
            effectiveTimeline =
                _buildFallbackTimeline(data['vaccineId'] as String, data);
          }
          final firstDose = effectiveTimeline.isNotEmpty
              ? effectiveTimeline.first['doseNumber']
              : null;
          final lastDose = effectiveTimeline.isNotEmpty
              ? effectiveTimeline.last['doseNumber']
              : null;
          final totalDoses = effectiveTimeline.length;
          final fallbackTotal =
              int.tryParse(data['rawDosesRequired']?.toString() ?? '') ??
                  totalDoses;
          final normalizedTotal = totalDoses > 0
              ? totalDoses
              : (fallbackTotal > 0 ? fallbackTotal : 1);

          final vaccineId = data['vaccineId'] as String;
          final timelineClone = _cloneTimeline(effectiveTimeline);
          _doseTimelineByVaccine[vaccineId] = timelineClone;

          return {
            'vaccineId': data['vaccineId'],
            'vaccineName': data['vaccineName'],
            'dosesRequired': normalizedTotal.toString(),
            'doseRangeLabel': firstDose != null && lastDose != null
                ? (firstDose == lastDose
                    ? 'Dose ${firstDose.toInt()}'
                    : 'Doses ${firstDose.toInt()}-${lastDose.toInt()}')
                : null,
            'ageUnit': data['primaryAgeUnit'],
            'specificAge': data['primarySpecificAge'],
            'minAge': data['primaryMinAge'],
            'maxAge': data['primaryMaxAge'],
            'doseTimeline': timelineClone,
          };
        }).toList();
        
        setState(() {
          _availableVaccines = individualVaccines;
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = "Erreur lors du chargement du calendrier vaccinal";
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

  Future<void> _saveSelectedVaccines() async {
    setState(() {
      _error = null;
    });

    // Si aucun vaccin sélectionné, appeler l'API pour activer le compte
    if (_selectedVaccinesWithDoses.isEmpty) {
      await _activateAccountWithoutVaccines();
      return;
    }

    final selectedEntries = _prepareSelectedDoseEntries();
    if (selectedEntries.isEmpty) {
      setState(() {
        _error =
            "Impossible de préparer les vaccins sélectionnés. Veuillez réessayer.";
      });
      return;
    }

    final deepCopy = selectedEntries
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList(growable: false);

    await Navigator.push(
      context,
      MaterialPageRoute(
        settings: RouteSettings(arguments: deepCopy),
        builder: (_) => VaccinationDateScreen(
          selectedVaccines: deepCopy,
          childId: widget.childId,
          token: widget.token,
          userData: widget.userData,
        ),
      ),
    );
  }

  Future<void> _activateAccountWithoutVaccines() async {
    try {
      final endpoint = Uri.parse(
        "${ApiConfig.apiBaseUrl}/mobile/children/${widget.childId}/mark-vaccines-done",
      );

      final response = await http.post(
        endpoint,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer ${widget.token}",
        },
        body: jsonEncode({"vaccines": []}), // Tableau vide pour activer le compte
      );

      if (!mounted) return;

      if (response.statusCode == 200 || response.statusCode == 201) {
        final responseData = jsonDecode(response.body);
        final isActive = responseData['isActive'] ?? false;

        if (isActive) {
          // Le compte est activé, naviguer vers le dashboard
          await _navigateToChildDashboard();
        } else {
          setState(() {
            _error = "Erreur lors de l'activation du compte. Veuillez réessayer.";
          });
        }
      } else {
        final data = jsonDecode(response.body);
        setState(() {
          _error = data["message"] ?? "Impossible d'activer le compte.";
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = "Erreur de connexion au serveur.";
      });
    }
  }

  List<Map<String, dynamic>> _prepareSelectedDoseEntries() {
    final Map<String, Map<String, dynamic>> vaccineLookup = {
      for (final vaccine in _availableVaccines)
        if (vaccine['vaccineId'] is String)
          vaccine['vaccineId'] as String: vaccine,
    };

    final entries = <Map<String, dynamic>>[];

    _selectedVaccinesWithDoses.forEach((key, dosesCount) {
      final vaccineData = vaccineLookup[key];
      if (vaccineData == null) {
        return;
      }

      final List<Map<String, dynamic>> doseTimeline =
          _doseTimelineByVaccine[key] ??
          _cloneTimeline(vaccineData['doseTimeline']);
      if (doseTimeline.isEmpty) {
        return;
      }

      final int assignable =
          dosesCount.clamp(0, doseTimeline.length).toInt();

      for (int index = 0; index < assignable; index++) {
        final slot = doseTimeline[index];
        final calendarId = slot['calendarId'] as String?;
        final doseNumber = slot['doseNumber'] is num
            ? (slot['doseNumber'] as num).toInt()
            : (index + 1);
        if (calendarId == null) {
          continue;
        }
        entries.add({
          'vaccineId': key,
          'vaccineName': vaccineData['vaccineName'] as String? ?? "Vaccin",
          'vaccineCalendarId': calendarId,
          'dose': doseNumber,
        });
      }
    });

    entries.sort((a, b) {
      final nameA = (a['vaccineName'] as String? ?? '').toLowerCase();
      final nameB = (b['vaccineName'] as String? ?? '').toLowerCase();
      if (nameA == nameB) {
        return (a['dose'] as int).compareTo(b['dose'] as int);
      }
      return nameA.compareTo(nameB);
    });

    return entries;
  }

  Future<void> _navigateToChildDashboard() async {
    if (!mounted) return;
    
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => ChildDashboardScreen(
          userData: widget.userData,
          childId: widget.childId,
        ),
      ),
    );
  }

  String _getAgeLabel(Map<String, dynamic> vaccine) {
    final ageUnit = vaccine['ageUnit'] as String;
    final specificAge = vaccine['specificAge'];
    final minAge = vaccine['minAge'];

    int age = specificAge ?? minAge ?? 0;
    String unit = '';

    switch (ageUnit) {
      case 'WEEKS':
        unit = age > 1 ? 'semaines' : 'semaine';
        break;
      case 'MONTHS':
        unit = 'mois';
        break;
      case 'YEARS':
        unit = age > 1 ? 'ans' : 'an';
        break;
    }

    if (age == 0 && ageUnit == 'WEEKS') {
      return 'À la naissance';
    }

    return '$age $unit';
  }

  @override
  Widget build(BuildContext context) {
    final childAge = _getChildAgeInMonths();

    return Scaffold(
      backgroundColor: Colors.white,
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
          "Vaccins déjà faits",
          style: GoogleFonts.poppins(
            color: const Color(0xFF0A1A33),
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          // En-tête informatif
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF3B760F).withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: const Color(0xFF3B760F).withOpacity(0.3),
              ),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.info_outline,
                      color: Color(0xFF3B760F),
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        "Âge de l'enfant: ${childAge >= 12 ? '${(childAge / 12).floor()} an(s)' : '$childAge mois'}",
                        style: GoogleFonts.poppins(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF3B760F),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  "Sélectionnez les vaccins que votre enfant a déjà reçus. Ces informations nous aideront à suivre son calendrier vaccinal.",
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: const Color(0xFF64748B),
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),

          // Liste des vaccins
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      color: Color(0xFF3B760F),
                    ),
                  )
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.error_outline,
                                color: Colors.red,
                                size: 60,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                _error!,
                                style: GoogleFonts.poppins(
                                  fontSize: 16,
                                  color: Colors.red,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadVaccineCalendar,
                                child: const Text("Réessayer"),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _availableVaccines.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(
                                    Icons.vaccines_outlined,
                                    color: Color(0xFF64748B),
                                    size: 60,
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    "Aucun vaccin disponible pour cet âge",
                                    style: GoogleFonts.poppins(
                                      fontSize: 16,
                                      color: const Color(0xFF64748B),
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _availableVaccines.length,
                            itemBuilder: (context, index) {
                              final vaccine = _availableVaccines[index];
                              final vaccineName =
                                  vaccine['vaccineName'] as String? ?? "Vaccin";
                              final vaccineId = vaccine['vaccineId'] as String?;
                              if (vaccineId == null) {
                                return const SizedBox.shrink();
                              }
                              final dosesRequiredStr =
                                  vaccine['dosesRequired'] as String? ?? '1';
                              final parsedDosesRequired =
                                  int.tryParse(dosesRequiredStr) ?? 1;
                              final List<Map<String, dynamic>> doseTimeline =
                                  (vaccine['doseTimeline'] as List?)
                                          ?.whereType<Map>()
                                          .map(
                                            (entry) => Map<String, dynamic>.from(
                                              entry.cast<String, dynamic>(),
                                            ),
                                          )
                                          .toList() ??
                                      [];
                              final dosesRequired = doseTimeline.isNotEmpty
                                  ? doseTimeline.length
                                  : parsedDosesRequired;

                              final vaccineKey = vaccineId;

                              final selectedDoses =
                                  _selectedVaccinesWithDoses[vaccineKey] ?? 0;
                              final isSelected = selectedDoses > 0;

                              return Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  side: BorderSide(
                                    color: isSelected
                                        ? const Color(0xFF3B760F)
                                        : const Color(0xFFE2E8F0),
                                    width: isSelected ? 2 : 1,
                                  ),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Checkbox(
                                            value: isSelected,
                                            onChanged: (bool? value) {
                                              setState(() {
                                                if (value == true) {
                                                  _selectedVaccinesWithDoses[vaccineKey] = 1;
                                                } else {
                                                  _selectedVaccinesWithDoses.remove(vaccineKey);
                                                }
                                              });
                                            },
                                            activeColor: const Color(0xFF3B760F),
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  vaccineName,
                                                  style: GoogleFonts.poppins(
                                                    fontSize: 15,
                                                    fontWeight: FontWeight.w600,
                                                    color: const Color(0xFF0A1A33),
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                'Recommandé à ${_getAgeLabel(vaccine)} • $dosesRequired dose${dosesRequired > 1 ? 's' : ''} au total',
                                                  style: GoogleFonts.poppins(
                                                    fontSize: 12,
                                                    color: const Color(0xFF94A3B8),
                                                  ),
                                                ),
                                              if (vaccine['doseRangeLabel'] != null) ...[
                                                const SizedBox(height: 2),
                                                Text(
                                                  vaccine['doseRangeLabel'] as String,
                                                  style: GoogleFonts.poppins(
                                                    fontSize: 11,
                                                    color: const Color(0xFF64748B),
                                                    fontWeight: FontWeight.w500,
                                                  ),
                                                ),
                                              ],
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (isSelected) ...[
                                        const SizedBox(height: 12),
                                        Text(
                                          'Combien de doses avez-vous déjà reçues ?',
                                          style: GoogleFonts.poppins(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                            color: const Color(0xFF0A1A33),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: List.generate(dosesRequired, (index) {
                                            final doseNumber = index + 1;
                                            final isDoseSelected = selectedDoses >= doseNumber;
                                            return Expanded(
                                              child: Padding(
                                                padding: EdgeInsets.only(
                                                  right: index < dosesRequired - 1 ? 8 : 0,
                                                ),
                                                child: GestureDetector(
                                                  onTap: () {
                                                    setState(() {
                                                      if (isDoseSelected && selectedDoses == doseNumber) {
                                                        // Désélectionner cette dose et toutes celles après
                                                        _selectedVaccinesWithDoses[vaccineKey] = doseNumber - 1;
                                                        if (doseNumber - 1 == 0) {
                                                          _selectedVaccinesWithDoses.remove(vaccineKey);
                                                        }
                                                      } else {
                                                        // Sélectionner jusqu'à cette dose
                                                        _selectedVaccinesWithDoses[vaccineKey] = doseNumber;
                                                      }
                                                    });
                                                  },
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                                    decoration: BoxDecoration(
                                                      color: isDoseSelected
                                                          ? const Color(0xFF3B760F).withOpacity(0.1)
                                                          : const Color(0xFFF8FAFC),
                                                      borderRadius: BorderRadius.circular(12),
                                                      border: Border.all(
                                                        color: isDoseSelected
                                                            ? const Color(0xFF3B760F)
                                                            : const Color(0xFFE2E8F0),
                                                        width: isDoseSelected ? 2 : 1,
                                                      ),
                                                    ),
                                                    child: Center(
                                                      child: Text(
                                                        'Dose $doseNumber',
                                                        style: GoogleFonts.poppins(
                                                          fontSize: 13,
                                                          fontWeight: isDoseSelected
                                                              ? FontWeight.w600
                                                              : FontWeight.w500,
                                                          color: isDoseSelected
                                                              ? const Color(0xFF3B760F)
                                                              : const Color(0xFF64748B),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            );
                                          }),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),

          // Bouton de validation
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -5),
                ),
              ],
            ),
            child: Column(
              children: [
                if (_selectedVaccinesWithDoses.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      "${_selectedVaccinesWithDoses.length} vaccin(s) sélectionné(s)",
                      style: GoogleFonts.poppins(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF3B760F),
                      ),
                    ),
                  ),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _saveSelectedVaccines,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3B760F),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 0,
                    ),
                    child: Text(
                      _selectedVaccinesWithDoses.isEmpty
                          ? "Continuer sans sélection"
                          : "Valider et continuer",
                      style: GoogleFonts.poppins(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
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

