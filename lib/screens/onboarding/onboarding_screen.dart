import 'dart:async';
import 'package:flutter/material.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/system_settings.dart';
import '../auth/auth_option_screen.dart';

class OnboardingScreen extends StatefulWidget {
  final SystemSettings? settings;
  
  const OnboardingScreen({super.key, this.settings});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int currentIndex = 0;
  late Timer _timer;

  late final List<Map<String, String>> onboardingData;
  
  @override
  void initState() {
    super.initState();
    
    // Construire les données d'onboarding avec les settings
    onboardingData = [
      {
        "image": widget.settings?.onboardingSlide1Image ?? "assets/images/onboarding1.png",
        "title": widget.settings?.onboardingSlide1Title ?? "Calendrier vaccinal simplifié",
        "subtitle": widget.settings?.onboardingSlide1Subtitle ?? "Consultez tous les rendez-vous de vaccination de vos enfants en un seul endroit.",
        "bg": widget.settings?.mobileBackgroundColor ?? "0xFF0A1A33",
        "button": "Suivant",
      },
      {
        "image": widget.settings?.onboardingSlide2Image ?? "assets/images/onboarding2.png",
        "title": widget.settings?.onboardingSlide2Title ?? "Suivi professionnel et personnalisé",
        "subtitle": widget.settings?.onboardingSlide2Subtitle ?? "Des agents de santé qualifiés pour accompagner chaque étape de la vaccination.",
        "bg": widget.settings?.mobileBackgroundColor ?? "0xFF0A1A33",
        "button": "Suivant",
      },
      {
        "image": widget.settings?.onboardingSlide3Image ?? "assets/images/onboarding3.png",
        "title": widget.settings?.onboardingSlide3Title ?? "Notifications et rappels intelligents",
        "subtitle": widget.settings?.onboardingSlide3Subtitle ?? "Ne manquez plus jamais un vaccin important pour la santé de votre enfant.",
        "bg": widget.settings?.mobileBackgroundColor ?? "0xFF0A1A33",
        "button": "Commencer",
      },
    ];

    // Timer pour le défilement automatique toutes les 4 secondes
    _timer = Timer.periodic(const Duration(seconds: 4), (Timer timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      if (currentIndex < onboardingData.length - 1) {
        currentIndex++;
        if (!mounted) return;
        _controller.animateToPage(
          currentIndex,
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
        );
      } else {
        // Si on atteint la dernière page → redirection automatique vers le choix d'authentification
        timer.cancel();
        Future.delayed(const Duration(seconds: 2), () {
          if (!mounted) return;
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => const AuthOptionScreen()),
          );
        });
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _timer.cancel();
    super.dispose();
  }

  /// Construit le widget d'image (réseau ou local)
  Widget _buildImage(String imageUrl) {
    // Si c'est une URL http(s), utiliser CachedNetworkImage
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return CachedNetworkImage(
        imageUrl: imageUrl,
        width: double.infinity,
        fit: BoxFit.contain,
        alignment: Alignment.center,
        placeholder: (context, url) => const Center(
          child: CircularProgressIndicator(color: Colors.white),
        ),
        errorWidget: (context, url, error) => Image.asset(
          'assets/images/onboarding1.png',
          width: double.infinity,
          fit: BoxFit.contain,
          alignment: Alignment.center,
        ),
      );
    } else {
      // Image locale
      return Image.asset(
        imageUrl,
        width: double.infinity,
        fit: BoxFit.contain,
        alignment: Alignment.center,
      );
    }
  }

  /// Récupère la couleur du bouton depuis les settings
  Color _getButtonColor() {
    if (widget.settings?.mobileButtonColor != null) {
      try {
        final colorStr = widget.settings!.mobileButtonColor!.replaceAll('#', '');
        return Color(int.parse('FF$colorStr', radix: 16));
      } catch (e) {
        return const Color(0xFF3B760F);
      }
    }
    return const Color(0xFF3B760F);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PageView.builder(
        controller: _controller,
        onPageChanged: (index) => setState(() => currentIndex = index),
        itemCount: onboardingData.length,
        itemBuilder: (context, index) {
          final data = onboardingData[index];
          
          // Convertir la couleur de fond
          Color backgroundColor;
          try {
            final bgStr = data["bg"]!;
            if (bgStr.startsWith('#')) {
              backgroundColor = Color(int.parse('FF${bgStr.substring(1)}', radix: 16));
            } else {
              backgroundColor = Color(int.parse(bgStr));
            }
          } catch (e) {
            backgroundColor = const Color(0xFF0A1A33);
          }

          return Container(
            color: backgroundColor,
            child: SafeArea(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const SizedBox(height: 40),

                  // Image parfaitement centrée
                  Expanded(
                    flex: 6,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: _buildImage(data["image"]!),
                    ),
                  ),

                  // Zone de texte + indicateur + bouton
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 40),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          data["title"]!,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.poppins(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            height: 1.3,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          data["subtitle"]!,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.poppins(
                            fontSize: 15.5,
                            height: 1.6,
                            color: Colors.white.withOpacity(0.85),
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                        const SizedBox(height: 35),

                        SmoothPageIndicator(
                          controller: _controller,
                          count: onboardingData.length,
                          effect: ExpandingDotsEffect(
                            activeDotColor: Colors.white,
                            dotColor: Colors.white.withOpacity(0.3),
                            dotHeight: 10,
                            dotWidth: 10,
                            spacing: 8,
                            expansionFactor: 3,
                          ),
                        ),
                        const SizedBox(height: 32),

                        ElevatedButton(
                          onPressed: () {
                            if (index == onboardingData.length - 1) {
                              Navigator.pushReplacement(
                                context,
                                MaterialPageRoute(builder: (_) => const AuthOptionScreen()),
                              );
                            } else {
                              _controller.nextPage(
                                duration: const Duration(milliseconds: 400),
                                curve: Curves.easeInOut,
                              );
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _getButtonColor(),
                            elevation: 3,
                            shadowColor: Colors.black.withOpacity(0.3),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(50),
                            ),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 80, vertical: 16),
                          ),
                          child: Text(
                            data["button"]!,
                            style: GoogleFonts.poppins(
                              fontSize: 17,
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}



