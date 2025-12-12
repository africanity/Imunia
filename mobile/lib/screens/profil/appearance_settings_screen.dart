import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class AppearanceSettingsScreen extends StatelessWidget {
  const AppearanceSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Apparence'),
      ),
      body: const Center(
        child: Text('À implémenter'),
      ),
    );
  }
}

