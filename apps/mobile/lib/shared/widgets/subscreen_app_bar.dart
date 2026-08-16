import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The header a pushed screen wears: a back arrow and a title, nothing else.
///
/// This is the shape the app already uses almost everywhere — Convites, a
/// user's profile, Associar clínica and a dozen more each build it by hand.
/// The few screens that reached for [AtlasAppBar] instead got the shell's
/// chrome on a screen that is not part of the shell: the AtlasMed breadcrumb,
/// and a hamburger that quietly behaved as back because there was no drawer to
/// open. Same destination, different furniture, and the furniture was the part
/// that lied.
///
/// Built as a [PreferredSizeWidget] so it drops into `Scaffold.appBar` where
/// those screens already had one.
class SubscreenAppBar extends StatelessWidget implements PreferredSizeWidget {
  const SubscreenAppBar({
    super.key,
    required this.title,
    this.actions,
    this.backgroundColor,
  });

  final String title;
  final List<Widget>? actions;

  /// Defaults to the app background, which is what the hand-built headers sit
  /// on. Screens with a white body pass white so the seam does not show.
  final Color? backgroundColor;

  @override
  Size get preferredSize => const Size.fromHeight(52);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: backgroundColor ?? AppColors.background,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      toolbarHeight: preferredSize.height,
      titleSpacing: 0,
      leading: IconButton(
        key: const Key('subscreen-back'),
        // `maybePop` rather than `pop`: these screens are pushed, but a
        // deep link can land on one with nothing beneath it.
        onPressed: () =>
            context.canPop() ? context.pop() : Navigator.of(context).maybePop(),
        icon: const Icon(Icons.arrow_back_rounded, color: AppColors.gray900),
      ),
      title: Text(
        title,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: AppColors.gray900,
        ),
      ),
      actions: actions,
    );
  }
}
