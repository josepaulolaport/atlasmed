import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Count chip for clustered clinic pins — number baked into the image so it
/// cannot drift away from the red circle (Mapbox text-offset is in ems and
/// was misaligned with icon-offset pixels).
class ClusterCountBadge {
  ClusterCountBadge._();

  /// Logical diameter of the chip.
  static const double logicalSize = 18;

  /// Style image id prefix: `atlasmed-badge-2` … `atlasmed-badge-99`,
  /// plus `atlasmed-badge-99p` for 100+.
  static const imageIdPrefix = 'atlasmed-badge-';
  static const overflowImageId = 'atlasmed-badge-99p';

  /// Offset from the geographic point (pin tip) to the chip center.
  /// Used by PointAnnotations (nearby map) and SymbolLayers (live map).
  static const List<double> iconOffset = [11, -38];
  static const List<double?> symbolIconOffset = [11, -38];

  static final Map<String, Uint8List> _cache = {};
  static double _registeredDpr = 0;

  static String imageIdForCount(int count) {
    if (count >= 100) return overflowImageId;
    return '$imageIdPrefix$count';
  }

  /// Mapbox expression: pick the pre-rasterized badge for `point_count`.
  static List<Object> get iconImageExpression => [
    'case',
    [
      '>=',
      ['get', 'point_count'],
      100,
    ],
    overflowImageId,
    [
      'concat',
      imageIdPrefix,
      [
        'to-string',
        [
          'min',
          ['get', 'point_count'],
          99,
        ],
      ],
    ],
  ];

  static Future<Uint8List> imageBytes({
    required int count,
    required double devicePixelRatio,
  }) async {
    final label = count > 99 ? '99+' : '$count';
    final dpr = devicePixelRatio.clamp(1.0, 4.0);
    final cacheKey = '$label@${dpr.toStringAsFixed(2)}';
    final cached = _cache[cacheKey];
    if (cached != null) return cached;

    final px = logicalSize * dpr;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, px, px));
    final center = Offset(px / 2, px / 2);
    final radius = px / 2;

    canvas.drawCircle(
      center.translate(0, 0.6 * dpr),
      radius,
      Paint()
        ..color = const Color(0x66000000)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, 1.1 * dpr),
    );

    canvas.drawCircle(center, radius, Paint()..color = Colors.white);
    canvas.drawCircle(
      center,
      radius - 1.5 * dpr,
      Paint()..color = const AppColors.error,
    );

    final fontSize =
        (label.length > 2
            ? 7.5
            : label.length > 1
            ? 9.0
            : 10.5) *
        dpr;
    final builder =
        ui.ParagraphBuilder(
            ui.ParagraphStyle(
              textAlign: TextAlign.center,
              fontSize: fontSize,
              fontWeight: FontWeight.w800,
              maxLines: 1,
            ),
          )
          ..pushStyle(
            ui.TextStyle(
              color: Colors.white,
              fontSize: fontSize,
              fontWeight: FontWeight.w800,
            ),
          )
          ..addText(label);
    final paragraph = builder.build()
      ..layout(ui.ParagraphConstraints(width: px));
    canvas.drawParagraph(paragraph, Offset(0, (px - paragraph.height) / 2));

    final image = await recorder.endRecording().toImage(px.ceil(), px.ceil());
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    if (byteData == null) {
      return Uint8List(0);
    }
    return _cache[cacheKey] = byteData.buffer.asUint8List();
  }

  /// Register badge-2 … badge-99 (+ 99+) on the Mapbox style once per DPR.
  static Future<void> ensureRegistered(
    StyleManager style, {
    required double devicePixelRatio,
  }) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if ((_registeredDpr - dpr).abs() < 0.01) {
      // Still re-add — style reloads clear images.
    }
    _registeredDpr = dpr;

    Future<void> add(String id, int count) async {
      final bytes = await imageBytes(count: count, devicePixelRatio: dpr);
      if (bytes.isEmpty) return;
      final px = (logicalSize * dpr).ceil();
      await style.addStyleImage(
        id,
        dpr,
        MbxImage(width: px, height: px, data: bytes),
        false,
        [],
        [],
        null,
      );
    }

    for (var n = 2; n <= 99; n++) {
      await add(imageIdForCount(n), n);
    }
    await add(overflowImageId, 100);
  }
}
