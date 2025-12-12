import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import '../../core/config/api_config.dart';
import '../child/child_dashboard_screen.dart';

class VaccinationProofUploadScreen extends StatefulWidget {
  final String childId;
  final String token;
  final Map<String, dynamic> userData;

  const VaccinationProofUploadScreen({
    super.key,
    required this.childId,
    required this.token,
    required this.userData,
  });

  @override
  State<VaccinationProofUploadScreen> createState() =>
      _VaccinationProofUploadScreenState();
}

class _VaccinationProofUploadScreenState
    extends State<VaccinationProofUploadScreen> {
  final ImagePicker _picker = ImagePicker();
  final List<File> _selectedFiles = [];
  bool _isUploading = false;
  String? _error;
  bool _canSkip = false;

  @override
  void initState() {
    super.initState();
    // Permettre de passer après 3 secondes
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          _canSkip = true;
        });
      }
    });
  }

  Future<void> _pickImages() async {
    try {
      final List<XFile>? images = await _picker.pickMultiImage(
        imageQuality: 85,
      );

      if (images != null && images.isNotEmpty) {
        setState(() {
          _selectedFiles.addAll(
            images.map((xFile) => File(xFile.path)).toList(),
          );
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = "Erreur lors de la sélection des images: $e";
        });
      }
    }
  }

  Future<void> _takePhoto() async {
    try {
      final XFile? photo = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
      );

      if (photo != null && mounted) {
        setState(() {
          _selectedFiles.add(File(photo.path));
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = "Erreur lors de la prise de photo: $e";
        });
      }
    }
  }

  void _removeFile(int index) {
    setState(() {
      _selectedFiles.removeAt(index);
    });
  }

  Future<void> _uploadAndContinue() async {
    if (_selectedFiles.isEmpty && !_canSkip) {
      setState(() {
        _error = "Veuillez ajouter au moins une photo du carnet de vaccination.";
      });
      return;
    }

    setState(() {
      _isUploading = true;
      _error = null;
    });

    try {
      // Si des fichiers sont sélectionnés, les uploader
      if (_selectedFiles.isNotEmpty) {
        final uri = Uri.parse(
          "${ApiConfig.apiBaseUrl}/mobile/children/${widget.childId}/vaccination-proofs",
        );

        final request = http.MultipartRequest('POST', uri);
        request.headers['Authorization'] = 'Bearer ${widget.token}';

        for (final file in _selectedFiles) {
          try {
            if (!await file.exists()) {
              throw Exception('Le fichier n\'existe plus: ${file.path}');
            }
            final fileStream = http.ByteStream(file.openRead());
            final length = await file.length();
            if (length == 0) {
              throw Exception('Le fichier est vide: ${file.path}');
            }
            final fileName = file.path.split(Platform.pathSeparator).last;
            final multipartFile = http.MultipartFile(
              'files',
              fileStream,
              length,
              filename: fileName,
            );
            request.files.add(multipartFile);
          } catch (e) {
            throw Exception('Erreur lors de la préparation du fichier ${file.path}: $e');
          }
        }

        final streamedResponse = await request.send();
        final response = await http.Response.fromStream(streamedResponse);

        if (response.statusCode == 200 || response.statusCode == 201) {
          // Après l'upload, le compte reste non activé (en attente de vérification)
          // Naviguer vers le dashboard avec le badge de vérification
          if (mounted) {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(
                builder: (_) => ChildDashboardScreen(
                  userData: widget.userData,
                  childId: widget.childId,
                ),
              ),
              (route) => false,
            );
          }
          return;
        }

        if (response.statusCode != 200 && response.statusCode != 201) {
          String errorMessage = 'Erreur lors de l\'upload';
          try {
            final data = jsonDecode(response.body);
            errorMessage = data['message'] ?? errorMessage;
          } catch (e) {
            final bodyText = response.body.length > 200 
                ? '${response.body.substring(0, 200)}...' 
                : response.body;
            errorMessage = 'Erreur ${response.statusCode}: $bodyText';
          }
          throw Exception(errorMessage);
        }
      }

      // Naviguer vers le dashboard
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (_) => ChildDashboardScreen(
            userData: widget.userData,
            childId: widget.childId,
          ),
        ),
        (route) => false,
      );
    } catch (error) {
      if (!mounted) return;
      String errorMessage = 'Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer plus tard.';
      if (error is Exception) {
        final errorStr = error.toString().replaceAll('Exception: ', '');
        if (errorStr.isNotEmpty && !errorStr.contains('null')) {
          errorMessage = errorStr;
        }
      } else if (error.toString().isNotEmpty) {
        errorMessage = error.toString();
      }
      setState(() {
        _error = errorMessage;
        _isUploading = false;
      });
    }
  }

  Future<void> _skipUpload() async {
    if (!_canSkip) {
      return;
    }

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => ChildDashboardScreen(
          userData: widget.userData,
          childId: widget.childId,
        ),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Preuve de vaccination",
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF3B760F).withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        color: const Color(0xFF3B760F),
                        size: 24,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          "Ajoutez une photo ou un scan de votre carnet de vaccination",
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF3B760F),
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "Cela permettra aux agents de vérifier la conformité de vos informations.",
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey[700],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isUploading ? null : _pickImages,
                    icon: const Icon(Icons.photo_library),
                    label: const Text("Galerie"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3B760F),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isUploading ? null : _takePhoto,
                    icon: const Icon(Icons.camera_alt),
                    label: const Text("Caméra"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3B760F),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                ),
              ],
            ),
            if (_selectedFiles.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text(
                "Fichiers sélectionnés (${_selectedFiles.length})",
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 12),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemCount: _selectedFiles.length,
                itemBuilder: (context, index) {
                  final file = _selectedFiles[index];
                  return Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(
                          file,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: GestureDetector(
                          onTap: () => _removeFile(index),
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.red,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close,
                              color: Colors.white,
                              size: 16,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red[200]!),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red[700]),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: GoogleFonts.poppins(
                          color: Colors.red[700],
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isUploading ? null : _uploadAndContinue,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF3B760F),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _isUploading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : Text(
                      _selectedFiles.isEmpty && _canSkip
                          ? "Continuer sans photo"
                          : "Continuer",
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                      ),
                    ),
            ),
            if (_canSkip && _selectedFiles.isEmpty) ...[
              const SizedBox(height: 12),
              TextButton(
                onPressed: _isUploading ? null : _skipUpload,
                child: Text(
                  "Passer cette étape",
                  style: GoogleFonts.poppins(
                    color: Colors.grey[600],
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

