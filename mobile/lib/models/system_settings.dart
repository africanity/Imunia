class SystemSettings {
  final String? appName;
  final String? appSubtitle;
  final String? logoUrl;
  final String? mobileBackgroundColor;
  final String? mobileButtonColor;
  final String? onboardingSlide1Image;
  final String? onboardingSlide1Title;
  final String? onboardingSlide1Subtitle;
  final String? onboardingSlide2Image;
  final String? onboardingSlide2Title;
  final String? onboardingSlide2Subtitle;
  final String? onboardingSlide3Image;
  final String? onboardingSlide3Title;
  final String? onboardingSlide3Subtitle;

  SystemSettings({
    this.appName,
    this.appSubtitle,
    this.logoUrl,
    this.mobileBackgroundColor,
    this.mobileButtonColor,
    this.onboardingSlide1Image,
    this.onboardingSlide1Title,
    this.onboardingSlide1Subtitle,
    this.onboardingSlide2Image,
    this.onboardingSlide2Title,
    this.onboardingSlide2Subtitle,
    this.onboardingSlide3Image,
    this.onboardingSlide3Title,
    this.onboardingSlide3Subtitle,
  });

  factory SystemSettings.fromJson(Map<String, dynamic> json) {
    return SystemSettings(
      appName: json['appName'] as String?,
      appSubtitle: json['appSubtitle'] as String?,
      logoUrl: json['logoUrl'] as String?,
      mobileBackgroundColor: json['mobileBackgroundColor'] as String?,
      mobileButtonColor: json['mobileButtonColor'] as String?,
      onboardingSlide1Image: json['onboardingSlide1Image'] as String?,
      onboardingSlide1Title: json['onboardingSlide1Title'] as String?,
      onboardingSlide1Subtitle: json['onboardingSlide1Subtitle'] as String?,
      onboardingSlide2Image: json['onboardingSlide2Image'] as String?,
      onboardingSlide2Title: json['onboardingSlide2Title'] as String?,
      onboardingSlide2Subtitle: json['onboardingSlide2Subtitle'] as String?,
      onboardingSlide3Image: json['onboardingSlide3Image'] as String?,
      onboardingSlide3Title: json['onboardingSlide3Title'] as String?,
      onboardingSlide3Subtitle: json['onboardingSlide3Subtitle'] as String?,
    );
  }
}



