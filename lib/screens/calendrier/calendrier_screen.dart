import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:table_calendar/table_calendar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/config/api_config.dart';

class CalendrierVaccinalScreen extends StatefulWidget {
  final Map<String, dynamic> child;
  final String? apiBase;

  const CalendrierVaccinalScreen({
    super.key,
    required this.child,
    this.apiBase,
  });

  @override
  State<CalendrierVaccinalScreen> createState() =>
      _CalendrierVaccinalScreenState();
}

class _CalendrierVaccinalScreenState extends State<CalendrierVaccinalScreen> {
  final storage = const FlutterSecureStorage();
  bool loading = true;
  String? error;
  List<Map<String, dynamic>> allVaccines = [];
  Map<DateTime, List<Map<String, dynamic>>> _events = {};
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;
  String? _nextAppointmentDate;
  List<Map<String, dynamic>> _selectedEvents = [];

  // ⭐ Filtre "Fait" (légende)
  bool _filterDoneOnly = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  /* -------------------------------------------------------------------------- */
  /* 🧠 CHARGEMENT DES DONNÉES                                                 */
  /* -------------------------------------------------------------------------- */
  Future<void> _loadData() async {
    setState(() {
      loading = true;
      error = null;
      allVaccines.clear();
      _events.clear();
      _selectedEvents.clear();
    });

    final child = widget.child;
    final childId = child['_id']?.toString() ??
        child['id']?.toString() ??
        child['childId']?.toString();

    if (childId == null || childId.isEmpty) {
      setState(() {
        error = "Identifiant de l'enfant introuvable.";
        loading = false;
      });
      return;
    }

    final base = widget.apiBase ?? ApiConfig.baseUrl;
    List<Map<String, dynamic>> merged = [];

    try {
      // Utiliser l'endpoint mobile unifié
      final token = await storage.read(key: 'auth_token');
      final url = '$base/api/mobile/children/$childId/calendar';

      final resp = await http.get(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
      );

      if (resp.statusCode == 200) {
        final data = json.decode(resp.body);
        if (data is Map && data['merged'] is List) {
          merged = List<Map<String, dynamic>>.from(data['merged']);
        }
      } else {
        error = "Erreur ${resp.statusCode}";
      }
    } catch (e) {
      error = "Erreur de connexion : $e";
    }

    // 🧹 Nettoyage et déduplication améliorée
    final Map<String, Map<String, dynamic>> dedup = {};
    const priority = ["done", "confirmed", "planned", "scheduled", "missed"];

    for (var v in merged) {
      if (v['name'] == null || v['date'] == null) continue;
      final dateStr = v['date'].toString();
      final d = DateTime.tryParse(dateStr);
      if (d == null) continue;
      final key = "${v['name']}-${DateFormat('yyyy-MM-dd').format(d)}";

      if (!dedup.containsKey(key)) {
        dedup[key] = v;
      } else {
        // Garde le plus "avancé" dans la progression
        final old = dedup[key]!;
        final oldP = priority.indexOf(old['status'] ?? 'scheduled');
        final newP = priority.indexOf(v['status'] ?? 'scheduled');
        if (newP < oldP) dedup[key] = v;
      }
    }

    merged = dedup.values.toList();

    // 🗓️ Regrouper par jour
    final Map<DateTime, List<Map<String, dynamic>>> grouped = {};
    for (var v in merged) {
      if (v['date'] == null) continue;
      final d = DateTime.tryParse(v['date'].toString());
      if (d == null) continue;
      final key = DateTime(d.year, d.month, d.day);
      grouped.putIfAbsent(key, () => []).add(v);
    }

    // 📅 Détermination du prochain rendez-vous
    String? next;
    final upcoming = merged
        .where((v) =>
            ["scheduled", "planned", "pending", "due"].contains(v['status']) &&
            v['date'] != null)
        .toList();

    if (upcoming.isNotEmpty) {
      upcoming.sort((a, b) =>
          DateTime.parse(a['date']).compareTo(DateTime.parse(b['date'])));
      next = upcoming.first['date'];
    }

    if (!mounted) return;
    setState(() {
      loading = false;
      allVaccines = merged;
      _events = grouped;
      _nextAppointmentDate = next;
    });
  }

  /* -------------------------------------------------------------------------- */
  /* 🎨 COULEURS SELON STATUT + FILTRE                                         */
  /* -------------------------------------------------------------------------- */
  Color? _getBackgroundColorForDay(DateTime day) {
    final events = _events[DateTime(day.year, day.month, day.day)];
    if (events == null || events.isEmpty) return null;

    final hasDone = events.any((e) => e['status'] == 'done');
    final hasMissed = events.any((e) => e['status'] == 'missed');
    final hasPlanned = events.any((e) =>
        e['status'] == 'scheduled' ||
        e['status'] == 'planned' ||
        e['status'] == 'pending' ||
        e['status'] == 'due');

    // ⭐ Filtre "Fait" → n'afficher que les jours qui ont au moins un "done"
    if (_filterDoneOnly) {
      return hasDone ? Colors.green.withOpacity(0.7) : null;
    }

    // Palette par priorité : done > missed > planned
    if (hasDone) return Colors.green.withOpacity(0.7);
    if (hasMissed) return Colors.redAccent.withOpacity(0.7);
    if (hasPlanned) return Colors.orangeAccent.withOpacity(0.7);
    return null;
  }

  /* -------------------------------------------------------------------------- */
  /* 🎈 POPOVER (bottom sheet) POUR LES VACCINS FAITS DU JOUR                  */
  /* -------------------------------------------------------------------------- */
  void _maybeShowDonePopoverForDay(DateTime day) {
    final key = DateTime(day.year, day.month, day.day);
    final list = _events[key] ?? [];
    final done = list.where((e) => e['status'] == 'done').toList();
    if (done.isEmpty) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: false,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.black12,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                DateFormat('EEEE d MMMM yyyy', 'fr_FR').format(key),
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0A1A33),
                ),
              ),
              const SizedBox(height: 10),
              ...done.map((e) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.10),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.green.withOpacity(0.25)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: Colors.green),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          "${e['name']} déjà fait",
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Colors.green,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  /* -------------------------------------------------------------------------- */
  /* 🧱 INTERFACE UTILISATEUR                                                 */
  /* -------------------------------------------------------------------------- */
  @override
  Widget build(BuildContext context) {
    final childName = widget.child['name'] ?? widget.child['firstName'] ?? "Enfant";

    return Scaffold(
      appBar: AppBar(
        title: Text("Carnet de $childName"),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF0A1A33),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0A1A33)),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildHeader(childName),
                  if (_nextAppointmentDate != null)
                    _buildNextAppointment(_nextAppointmentDate!),
                  if (error != null) _buildError(error!),
                  const SizedBox(height: 12),
                  _buildCalendar(),
                  if (_selectedEvents.isNotEmpty)
                    _buildSelectedDaySummary(_selectedEvents),
                  const SizedBox(height: 16),
                  _buildLegend(), // ⭐ légende interactive (vert = filtre)
                  const SizedBox(height: 10),
                  _buildVaccinationList(),
                ],
              ),
            ),
    );
  }

  /* -------------------------------------------------------------------------- */
  /* 🧱 COMPOSANTS UI                                                        */
  /* -------------------------------------------------------------------------- */
  Widget _buildHeader(String childName) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFF3F7FB),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const CircleAvatar(
              radius: 28,
              backgroundColor: Color(0xFF0A1A33),
              child: Icon(Icons.child_care, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 16),
            Text(
              childName,
              style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  color: Color(0xFF0A1A33)),
            ),
          ],
        ),
      );

  Widget _buildNextAppointment(String dateStr) {
    final date = DateTime.tryParse(dateStr);
    final formatted = date != null
        ? DateFormat('EEEE d MMMM yyyy', 'fr_FR').format(date)
        : "Date inconnue";
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEAF3FF),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text("📅 Prochain rendez-vous : $formatted",
          style: const TextStyle(fontWeight: FontWeight.w600)),
    );
  }

  Widget _buildError(String msg) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.red.shade50,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(msg, style: const TextStyle(color: Colors.red)),
      );

  /* -------------------------------------------------------------------------- */
  /* 🗓️ CALENDRIER INTELLIGENT                                               */
  /* -------------------------------------------------------------------------- */
  Widget _buildCalendar() {
    return TableCalendar(
      focusedDay: _focusedDay,
      firstDay: DateTime.utc(2023, 1, 1),
      lastDay: DateTime.utc(2030, 12, 31),
      selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
      onDaySelected: (selected, focused) {
        setState(() {
          _selectedDay = selected;
          _focusedDay = focused;

          // Liste de la journée (non filtrée pour le panneau du bas)
          _selectedEvents =
              _events[DateTime(selected.year, selected.month, selected.day)] ??
                  [];
        });

        // ⭐ Si au moins un vaccin "fait" ce jour → popover "déjà fait"
        _maybeShowDonePopoverForDay(selected);
      },
      calendarBuilders: CalendarBuilders(
        defaultBuilder: (context, day, focusedDay) {
          final color = _getBackgroundColorForDay(day);
          return Container(
            margin: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color ?? Colors.transparent,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '${day.day}',
              style: TextStyle(
                color: color != null ? Colors.white : Colors.black87,
                fontWeight:
                    color != null ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          );
        },
        todayBuilder: (context, day, focusedDay) {
          final color = _getBackgroundColorForDay(day);
          return Container(
            margin: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color ?? Colors.blueAccent,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text('${day.day}',
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.bold)),
          );
        },
      ),
    );
  }

  /* -------------------------------------------------------------------------- */
  /* 🧾 DÉTAIL D'UN JOUR                                                     */
  /* -------------------------------------------------------------------------- */
  Widget _buildSelectedDaySummary(List<Map<String, dynamic>> events) {
    // ⭐ Appliquer le filtre dans le panneau récap si activé
    final filtered = _filterDoneOnly
        ? events.where((e) => e['status'] == 'done').toList()
        : events;

    final unique = {
      for (var e in filtered) e['name']: e
    }.values.toList(); // suppression doublons du jour

    if (unique.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      children: unique.map((event) {
        final status = event['status'] ?? '';
        final color = status == 'done'
            ? Colors.green
            : (status == 'missed'
                ? Colors.redAccent
                : Colors.orangeAccent);
        final dn = event['doseNumber'];
        final doseLabel = (dn is num && dn > 0)
            ? ' (Dose ${dn.toInt()})'
            : (event['dose'] != null && (event['dose'].toString()).trim().isNotEmpty
                ? ' (${event['dose']})'
                : '');
        final label = status == 'done'
            ? "✅ ${event['name']}$doseLabel déjà fait"
            : (status == 'missed'
                ? "❌ ${event['name']}$doseLabel manqué"
                : "🟡 ${event['name']}$doseLabel prévu pour cette date");
        return Container(
          margin: const EdgeInsets.only(top: 8, bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(label,
              style: TextStyle(
                  color: color, fontWeight: FontWeight.w600, fontSize: 15)),
        );
      }).toList(),
    );
  }

  /* -------------------------------------------------------------------------- */
  /* 🧭 LÉGENDE (INTERACTIVE – FILTRE FAIT)                                   */
  /* -------------------------------------------------------------------------- */
  Widget _buildLegend() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        // ⭐ Pastille "Fait" cliquable → filtre
        GestureDetector(
          onTap: () {
            setState(() => _filterDoneOnly = !_filterDoneOnly);
          },
          child: _LegendItem(
            color: Colors.green,
            label: _filterDoneOnly ? "Fait (filtre ON)" : "Fait",
            emphasized: _filterDoneOnly,
          ),
        ),
        const _LegendItem(color: Colors.orangeAccent, label: "À venir"),
        const _LegendItem(color: Colors.redAccent, label: "Raté"),
      ],
    );
  }

  /* -------------------------------------------------------------------------- */
  /* 📋 LISTE DES VACCINS (progression propre)                                */
  /* -------------------------------------------------------------------------- */
  Widget _buildVaccinationList() {
    final items = {
      for (var v in allVaccines)
        "${v['name']}-${DateFormat('yyyy-MM-dd').format(DateTime.parse(v['date']))}": v
    }.values.toList();

    items.sort((a, b) {
      final ad = DateTime.tryParse(a['date']);
      final bd = DateTime.tryParse(b['date']);
      if (ad == null || bd == null) return 0;
      return ad.compareTo(bd);
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '📆 Progression vaccinale',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        const SizedBox(height: 16),
        ...List.generate(items.length, (index) {
          final v = items[index];
          final dateStr = v['date']?.toString();
          final d = dateStr != null ? DateTime.tryParse(dateStr) : null;
          final formatted = d != null
              ? DateFormat('dd MMM yyyy', 'fr_FR').format(d)
              : '-';

          IconData icon;
          Color color;
          if (v['status'] == 'done') {
            icon = Icons.check_circle;
            color = Colors.green;
          } else if (v['status'] == 'missed') {
            icon = Icons.cancel;
            color = Colors.redAccent;
          } else {
            icon = Icons.access_time_filled;
            color = Colors.orangeAccent;
          }

          final dynamic doseCount = v['doseCount'];
          final dynamic firstDose = v['firstDoseNumber'];
          final dynamic lastDose = v['lastDoseNumber'];
          String? badgeText;
          if (doseCount is num && doseCount > 0) {
            if (firstDose is num && lastDose is num) {
              badgeText = firstDose == lastDose
                  ? 'Dose ${firstDose.toInt()}'
                  : 'Doses ${firstDose.toInt()}-${lastDose.toInt()}';
            } else {
              badgeText = '${doseCount.toInt()} dose(s)';
            }
          } else if (v['dose'] != null &&
              (v['dose'].toString()).trim().isNotEmpty) {
            badgeText = v['dose'].toString();
          }

          return Stack(
            children: [
              if (index < items.length - 1)
                Positioned(
                  left: 20,
                  top: 40,
                  bottom: 0,
                  child: Container(
                    width: 3,
                    color: Colors.grey.shade300,
                  ),
                ),
              Container(
                margin: const EdgeInsets.only(left: 0, bottom: 24),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 40,
                      alignment: Alignment.topCenter,
                      child: Icon(icon, color: color, size: 30),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            vertical: 8, horizontal: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.grey.shade200,
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    v['name'] ?? 'Vaccin',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                      color: Color(0xFF0A1A33),
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (badgeText != null) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.blue.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      badgeText!,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.blue,
                                      ),
                                    ),
                                  ),
                                ]
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(formatted,
                                style: const TextStyle(
                                    fontSize: 13, color: Colors.black54)),
                            const SizedBox(height: 2),
                            Text(
                              "${v['healthCenter'] ?? 'Centre inconnu'} • ${v['region'] ?? ''}",
                              style: const TextStyle(
                                  fontSize: 13, color: Colors.black54),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        }),
      ],
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 🎨 LÉGENDE INDIVIDUELLE                                                  */
/* -------------------------------------------------------------------------- */
class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;
  final bool emphasized;

  const _LegendItem({
    required this.color,
    required this.label,
    this.emphasized = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: emphasized ? 20 : 18,
          height: emphasized ? 20 : 18,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            boxShadow: emphasized
                ? [
                    BoxShadow(
                      color: color.withOpacity(0.35),
                      blurRadius: 8,
                      spreadRadius: 1,
                    )
                  ]
                : null,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontWeight: emphasized ? FontWeight.w700 : FontWeight.w500,
            fontSize: 14,
            color: emphasized ? const Color(0xFF0A1A33) : Colors.black87,
          ),
        ),
      ],
    );
  }
}
