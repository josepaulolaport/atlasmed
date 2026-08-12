import 'package:atlasmed_mobile_app/core/state/dispose_safe_state_notifier.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_photos_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/clinic_detail_providers.dart';

final facilityPhotosProvider = FutureProvider.autoDispose
    .family<PhotoGallerySummary, int>((ref, facilityId) async {
      final repo = FacilityPhotosRepository(facilityId);
      try {
        return await repo.loadGallery();
      } finally {
        repo.dispose();
      }
    });

final facilityPhotoUploadProvider = StateNotifierProvider.autoDispose
    .family<FacilityPhotoUploadController, AsyncValue<void>, int>((
      ref,
      facilityId,
    ) {
      return FacilityPhotoUploadController(ref, facilityId);
    });

class FacilityPhotoUploadController extends StateNotifier<AsyncValue<void>>
    with DisposeSafeStateWrites<AsyncValue<void>> {
  FacilityPhotoUploadController(this._ref, this.facilityId)
    : super(const AsyncData(null));

  final Ref _ref;
  final int facilityId;
  final ImagePicker _picker = ImagePicker();

  Future<void> pickAndUpload(ImageSource source) async {
    XFile? picked;
    try {
      picked = await _picker.pickImage(
        source: source,
        requestFullMetadata: false,
        imageQuality: 85,
        maxWidth: 2048,
        maxHeight: 2048,
      );
    } catch (_) {
      state = AsyncError(
        source == ImageSource.camera
            ? 'Não foi possível abrir a câmera. Tente novamente.'
            : 'Não foi possível abrir a galeria. Tente novamente.',
        StackTrace.current,
      );
      return;
    }

    if (picked == null) return;

    try {
      state = const AsyncLoading();
      final contentType = _contentTypeFor(picked.name, picked.mimeType);
      if (contentType == null) {
        throw const FacilityPhotosException(
          'Escolha uma imagem JPG, PNG ou WebP.',
        );
      }

      final bytes = await picked.readAsBytes();
      if (bytes.isEmpty || bytes.length > 5 * 1024 * 1024) {
        throw const FacilityPhotosException(
          'Escolha uma imagem JPG, PNG ou WebP de até 5 MB.',
        );
      }

      final repo = FacilityPhotosRepository(facilityId);
      try {
        await repo.upload(
          FacilityPhotoFile(
            name: picked.name,
            bytes: bytes,
            contentType: contentType,
          ),
        );
      } finally {
        repo.dispose();
      }

      // Refresh photos only — do not refetch facility detail / other sections.
      await _ref
          .read(facilityZipRepositoryProvider(facilityId))
          .refreshPhotos();
      _ref.invalidate(facilityPhotosProvider(facilityId));
      state = const AsyncData(null);
    } on FacilityPhotosException catch (error, stackTrace) {
      state = AsyncError(error.toString(), stackTrace);
    } catch (_) {
      state = AsyncError(
        'Não foi possível enviar a foto. Tente novamente.',
        StackTrace.current,
      );
    }
  }

  String? _contentTypeFor(String name, String? mimeType) {
    if (mimeType == 'image/jpeg' ||
        mimeType == 'image/png' ||
        mimeType == 'image/webp') {
      return mimeType;
    }
    final extension = name.split('.').last.toLowerCase();
    return switch (extension) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => null,
    };
  }
}
