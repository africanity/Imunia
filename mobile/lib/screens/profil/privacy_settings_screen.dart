import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class PrivacySettingsScreen extends StatelessWidget {
  final Map<String, dynamic> child;
  
  const PrivacySettingsScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vie privée et données'),
      ),
      body: const Center(
        child: Text('À implémenter'),
      ),
    );
  }
}

