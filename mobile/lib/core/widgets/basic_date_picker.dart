import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class BasicDatePicker {
  static Future<DateTime?> show({
    required BuildContext context,
    required DateTime initialDate,
    required DateTime firstDate,
    required DateTime lastDate,
    String? title,
  }) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
      locale: const Locale('fr', 'FR'),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF3B760F),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0A1A33),
            ),
          ),
          child: child!,
        );
      },
    );
    return picked;
  }
}



