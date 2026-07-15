import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/core/providers/session_provider.dart';
import 'package:atlasmed_mobile_app/features/auth/data/models/user.dart';
import 'package:atlasmed_mobile_app/features/profile/data/avatar_repository.dart';

final avatarRepositoryProvider = Provider<AvatarRepository>((ref) {
  final session = ref.watch(sessionProvider);
  return AvatarRepository(
    baseUrl: AppConfig.apiBaseUrl,
    tokenProvider: () async => session.currentValue?.token,
  );
});

final avatarControllerProvider =
    StateNotifierProvider<AvatarController, AsyncValue<void>>((ref) {
      return AvatarController(ref);
    });

class AvatarController extends StateNotifier<AsyncValue<void>> {
  AvatarController(this._ref) : super(const AsyncData(null));

  final Ref _ref;
  final ImagePicker _picker = ImagePicker();

  Future<void> chooseFromGallery() async {
    XFile? picked;
    try {
      picked = await _picker.pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
    } catch (_) {
      state = AsyncError(
        'Não foi possível abrir a galeria. Tente novamente.',
        StackTrace.current,
      );
      return;
    }

    if (picked == null) return;

    try {
      state = const AsyncLoading();
      final bytes = await picked.readAsBytes();
      final contentType = _contentTypeFor(picked.name);
      if (contentType == null) {
        throw const AvatarRepositoryException(
          'Escolha uma imagem JPG, PNG ou WebP.',
        );
      }

      final user = await _ref
          .read(avatarRepositoryProvider)
          .upload(
            AvatarFile(
              name: picked.name,
              bytes: bytes,
              contentType: contentType,
            ),
          );
      await _replaceSessionUser(user);
      state = const AsyncData(null);
    } on AvatarRepositoryException catch (error, stackTrace) {
      state = AsyncError(error.message, stackTrace);
    } catch (_) {
      state = AsyncError(
        'Não foi possível atualizar sua foto. Tente novamente.',
        StackTrace.current,
      );
    }
  }

  Future<void> remove() async {
    try {
      state = const AsyncLoading();
      final user = await _ref.read(avatarRepositoryProvider).remove();
      await _replaceSessionUser(user);
      state = const AsyncData(null);
    } on AvatarRepositoryException catch (error, stackTrace) {
      state = AsyncError(error.message, stackTrace);
    } catch (_) {
      state = AsyncError(
        'Não foi possível remover sua foto. Tente novamente.',
        StackTrace.current,
      );
    }
  }

  Future<void> recoverLostData() async {
    final response = await _picker.retrieveLostData();
    if (response.isEmpty || response.file == null) return;
    await _uploadRecovered(response.file!);
  }

  Future<void> _uploadRecovered(XFile picked) async {
    try {
      state = const AsyncLoading();
      final contentType = _contentTypeFor(picked.name);
      if (contentType == null) {
        throw const AvatarRepositoryException(
          'Escolha uma imagem JPG, PNG ou WebP.',
        );
      }
      final user = await _ref
          .read(avatarRepositoryProvider)
          .upload(
            AvatarFile(
              name: picked.name,
              bytes: await picked.readAsBytes(),
              contentType: contentType,
            ),
          );
      await _replaceSessionUser(user);
      state = const AsyncData(null);
    } catch (_) {
      state = AsyncError(
        'Não foi possível recuperar a foto selecionada.',
        StackTrace.current,
      );
    }
  }

  Future<void> _replaceSessionUser(User user) async {
    await _ref.read(userProvider).replaceCachedUser(user);
  }

  String? _contentTypeFor(String name) {
    final extension = name.split('.').last.toLowerCase();
    return switch (extension) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => null,
    };
  }
}
