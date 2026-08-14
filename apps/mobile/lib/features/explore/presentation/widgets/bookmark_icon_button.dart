import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/bookmarks_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/bookmarks_providers.dart';

/// The Favoritos toggle, shared by the clinic and doctor detail screens.
///
/// One widget rather than two: the interesting part is the optimistic flip and
/// its revert, and a second copy of that would be a second place for the revert
/// to go missing — which fails silently, leaving a filled icon for a bookmark
/// the server rejected.
class BookmarkIconButton extends ConsumerStatefulWidget {
  const BookmarkIconButton({
    required this.kind,
    required this.id,
    this.serverState,
    super.key,
  });

  final BookmarkKind kind;
  final int id;

  /// The server's answer, once the detail response has loaded.
  ///
  /// `null` means "not known yet" — the detail request is still in flight — and
  /// is deliberately distinct from `false`. Without that distinction a cold
  /// open paints every saved clinic as unsaved and only corrects itself after
  /// the user has already looked at it.
  final bool? serverState;

  @override
  ConsumerState<BookmarkIconButton> createState() => _BookmarkIconButtonState();
}

class _BookmarkIconButtonState extends ConsumerState<BookmarkIconButton> {
  /// Guards against a second tap landing while the first is still in flight,
  /// which would race two writes and could leave the icon disagreeing with the
  /// server.
  bool _inFlight = false;

  @override
  void initState() {
    super.initState();
    _seedFromServer();
  }

  @override
  void didUpdateWidget(BookmarkIconButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    // The detail response usually arrives after the app bar has painted, so
    // the first non-null value is the one that matters.
    if (oldWidget.serverState != widget.serverState) _seedFromServer();
  }

  void _seedFromServer() {
    final known = widget.serverState;
    if (known == null || _inFlight) return;
    // Post-frame: seeding touches a provider, which cannot happen during build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref
          .read(bookmarkedIdsProvider.notifier)
          .set(widget.kind, widget.id, bookmarked: known);
    });
  }

  Future<void> _toggle() async {
    if (_inFlight) return;
    setState(() => _inFlight = true);

    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(bookmarkedIdsProvider.notifier)
          .toggle(widget.kind, widget.id);
    } catch (_) {
      // The notifier has already put the icon back; this only explains why.
      if (mounted) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Não foi possível atualizar os favoritos'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _inFlight = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bookmarked = ref
        .watch(bookmarkedIdsProvider)
        .contains(BookmarkedIds.keyFor(widget.kind, widget.id));

    return IconButton(
      onPressed: _toggle,
      tooltip: bookmarked ? 'Remover dos favoritos' : 'Salvar nos favoritos',
      icon: Icon(
        bookmarked ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
      ),
    );
  }
}
