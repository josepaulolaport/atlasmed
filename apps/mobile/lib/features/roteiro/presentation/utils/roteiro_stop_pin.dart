import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// A map pin carrying its stop number and its time.
///
/// Both on the pin, deliberately. A rep looking at the day's map is asking two
/// questions at once — *what order do I do these in* and *when am I due* — and
/// answering only the first sends them back to the list for the second. The
/// order alone is what a generic numbered pin gives, and it is half an answer.
///
/// Rendered to PNG rather than drawn as a Flutter overlay because the Mapbox
/// annotation API takes image bytes, and an overlay would drift out of
/// alignment during pan and zoom.
class RoteiroStopPin {
  const RoteiroStopPin._();

  static const double logicalWidth = 74;
  static const double logicalHeight = 46;

  /// [order] is 1-based; [time] is `HH:MM`.
  static Future<Uint8List> png({
    required int order,
    required String time,
    required double devicePixelRatio,
    bool booked = false,
  }) async {
    final dpr = devicePixelRatio <= 0 ? 1.0 : devicePixelRatio;
    final w = (logicalWidth * dpr).ceil();
    final h = (logicalHeight * dpr).ceil();

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(
      recorder,
      Rect.fromLTWH(0, 0, w.toDouble(), h.toDouble()),
    );

    // Booked visits are the rep's existing commitments and read as context;
    // suggestions are the thing being proposed and lead.
    final fill = booked ? AppColors.gray600 : AppColors.navyBright;
    final bodyHeight = 30.0 * dpr;
    final radius = Radius.circular(8 * dpr);
    final body = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, w.toDouble(), bodyHeight),
      radius,
    );

    canvas.drawRRect(
      body,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.18)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, 2 * dpr),
    );
    canvas.drawRRect(body, Paint()..color = fill);

    // The tail, so the pin points at the clinic rather than floating above it.
    final tail = Path()
      ..moveTo(w / 2 - 6 * dpr, bodyHeight - 1)
      ..lineTo(w / 2, bodyHeight + 8 * dpr)
      ..lineTo(w / 2 + 6 * dpr, bodyHeight - 1)
      ..close();
    canvas.drawPath(tail, Paint()..color = fill);

    // Order badge.
    final badgeR = 9.0 * dpr;
    final badgeCx = badgeR + 6 * dpr;
    canvas.drawCircle(
      Offset(badgeCx, bodyHeight / 2),
      badgeR,
      Paint()..color = Colors.white.withValues(alpha: 0.22),
    );
    _text(
      canvas,
      '$order',
      Offset(badgeCx, bodyHeight / 2),
      fontSize: 11 * dpr,
      weight: FontWeight.w700,
      color: Colors.white,
      centred: true,
    );

    _text(
      canvas,
      time,
      Offset(badgeCx + badgeR + 6 * dpr, bodyHeight / 2),
      fontSize: 12 * dpr,
      weight: FontWeight.w600,
      color: Colors.white,
      centred: false,
    );

    final image = await recorder.endRecording().toImage(w, h);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    return bytes!.buffer.asUint8List();
  }

  static void _text(
    Canvas canvas,
    String value,
    Offset at, {
    required double fontSize,
    required FontWeight weight,
    required Color color,
    required bool centred,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: value,
        style: TextStyle(fontSize: fontSize, fontWeight: weight, color: color),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(
      canvas,
      Offset(
        centred ? at.dx - painter.width / 2 : at.dx,
        at.dy - painter.height / 2,
      ),
    );
  }
}
