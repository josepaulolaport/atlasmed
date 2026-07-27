import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Result of a local document pick (camera, gallery, or file).
class PickedRegistrationFile {
  const PickedRegistrationFile({
    required this.fileName,
    this.localPath,
    this.mimeType,
  });

  final String fileName;
  final String? localPath;
  final String? mimeType;
}

enum _PickKind { camera, gallery, file }

/// Bottom sheet: camera / gallery / any file (PDF, etc.).
Future<PickedRegistrationFile?> pickRegistrationDocument(
  BuildContext context,
) async {
  final kind = await showModalBottomSheet<_PickKind>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const AppColors.gray200,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const Text(
                'Enviar documento',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Foto, imagem da galeria ou arquivo (PDF e similares).',
                style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.camera_alt_outlined,
                  color: AppColors.navyBright,
                ),
                title: const Text('Tirar foto'),
                onTap: () => Navigator.of(sheetContext).pop(_PickKind.camera),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.photo_library_outlined,
                  color: AppColors.navyBright,
                ),
                title: const Text('Escolher da galeria'),
                onTap: () => Navigator.of(sheetContext).pop(_PickKind.gallery),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.insert_drive_file_outlined,
                  color: AppColors.navyBright,
                ),
                title: const Text('Escolher arquivo'),
                subtitle: const Text(
                  'PDF, documento ou imagem',
                  style: TextStyle(fontSize: 12, color: AppColors.gray400),
                ),
                onTap: () => Navigator.of(sheetContext).pop(_PickKind.file),
              ),
            ],
          ),
        ),
      );
    },
  );
  if (kind == null || !context.mounted) return null;

  try {
    switch (kind) {
      case _PickKind.camera:
      case _PickKind.gallery:
        final xFile = await ImagePicker().pickImage(
          source: kind == _PickKind.camera
              ? ImageSource.camera
              : ImageSource.gallery,
          requestFullMetadata: false,
        );
        if (xFile == null) return null;
        return PickedRegistrationFile(
          fileName: xFile.name,
          localPath: xFile.path,
          mimeType: xFile.mimeType ?? mimeFromFileName(xFile.name),
        );
      case _PickKind.file:
        final result = await FilePicker.platform.pickFiles(
          type: FileType.custom,
          allowedExtensions: const [
            'pdf',
            'jpg',
            'jpeg',
            'png',
            'webp',
            'heic',
            'doc',
            'docx',
          ],
          withData: false,
        );
        if (result == null || result.files.isEmpty) return null;
        final file = result.files.single;
        final name = file.name;
        return PickedRegistrationFile(
          fileName: name,
          localPath: file.path,
          mimeType: file.extension != null
              ? mimeFromExtension(file.extension!)
              : mimeFromFileName(name),
        );
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível abrir o seletor de arquivo'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    return null;
  }
}

String? mimeFromFileName(String name) {
  final lower = name.toLowerCase();
  final dot = lower.lastIndexOf('.');
  if (dot < 0) return null;
  return mimeFromExtension(lower.substring(dot + 1));
}

String? mimeFromExtension(String ext) {
  switch (ext.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return null;
  }
}
