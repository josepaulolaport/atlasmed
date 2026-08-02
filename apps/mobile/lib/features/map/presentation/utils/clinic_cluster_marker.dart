import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

/// Atomic cluster pin: disc + wider bottom pill (may spill) + all numbers in one PNG.
///
/// Shape = union(disc, pill) with one continuous stroke. Pill wider than disc.
/// No Mapbox text — glyphs on SymbolLayer paint over neighbor icons.
/// Image ids: `atlasmed-cluster-{s|m|l}-t{T}-a{A}-i{I}-n{N}` (`99p` if &gt;99).
final class ClinicClusterMarker {
  ClinicClusterMarker._();

  static const imageIdPrefix = 'atlasmed-cluster-';
  static const activeColor = PurchaseBucketFilter.mapActiveColor;
  static const inactiveColor = PurchaseBucketFilter.mapInactiveColor;
  static const neverBoughtColor = PurchaseBucketFilter.mapNeverBoughtColor;
  static const totalTextColor = AppColors.navyDeep;
  static const outlineColor = AppColors.blueAccent;

  static const _maxExact = 99;

  /// Bump when chrome layout changes so style images rebuild.
  static const _layoutVersion = 24;
  static int _registeredLayoutVersion = 0;
  static double _registeredDpr = 0;
  static final Map<String, ({Uint8List bytes, int width, int height})> _cache =
      {};
  static final Set<String> _inStyle = {};

  /// Disc + spilling pill. [pillOverlap] = how far pill tucks under disc.
  static ({
    double diameter,
    double strokeWidth,
    double pillH,
    double pillPadX,
    double pillMinExtra, // min width beyond diameter (each side total extra)
    double pillOverlap,
    double dotR,
    double totalFontSize,
    double pillFontSize,
  })
  layoutFor(String sizeTier) => switch (sizeTier) {
    'l' => (
      diameter: 72,
      strokeWidth: 5.0,
      pillH: 28,
      pillPadX: 12,
      pillMinExtra: 36,
      pillOverlap: 12,
      dotR: 3.2,
      totalFontSize: 24,
      pillFontSize: 13,
    ),
    'm' => (
      diameter: 60,
      strokeWidth: 4.4,
      pillH: 24,
      pillPadX: 10,
      pillMinExtra: 30,
      pillOverlap: 10,
      dotR: 2.8,
      totalFontSize: 20,
      pillFontSize: 12,
    ),
    _ => (
      diameter: 50,
      strokeWidth: 3.8,
      pillH: 22,
      pillPadX: 9,
      pillMinExtra: 26,
      pillOverlap: 9,
      dotR: 2.5,
      totalFontSize: 17,
      pillFontSize: 11,
    ),
  };

  static String sizeTierForCount(int pointCount) {
    if (pointCount >= 50) return 'l';
    if (pointCount >= 10) return 'm';
    return 's';
  }

  static String countKey(num? value) {
    final n = (value ?? 0).round();
    if (n > _maxExact) return '99p';
    if (n < 0) return '0';
    return '$n';
  }

  static String countLabel(num? value) {
    final n = (value ?? 0).round();
    if (n > _maxExact) return '99+';
    if (n < 0) return '0';
    return '$n';
  }

  static String imageId({
    required String sizeTier,
    required num total,
    required num active,
    required num inactive,
    required num neverBought,
  }) {
    return '$imageIdPrefix$sizeTier'
        '-t${countKey(total)}'
        '-a${countKey(active)}'
        '-i${countKey(inactive)}'
        '-n${countKey(neverBought)}';
  }

  static final _imageIdPattern = RegExp(
    r'^atlasmed-cluster-([sml])-t(\d+|99p)-a(\d+|99p)-i(\d+|99p)-n(\d+|99p)$',
  );

  /// Parse a style image id back into paint specs (for StyleImageMissing).
  static ({
    String sizeTier,
    num total,
    num active,
    num inactive,
    num neverBought,
  })?
  tryParseImageId(String id) {
    final match = _imageIdPattern.firstMatch(id);
    if (match == null) return null;
    num parseCount(String raw) => raw == '99p' ? _maxExact + 1 : num.parse(raw);
    return (
      sizeTier: match.group(1)!,
      total: parseCount(match.group(2)!),
      active: parseCount(match.group(3)!),
      inactive: parseCount(match.group(4)!),
      neverBought: parseCount(match.group(5)!),
    );
  }

  /// Register PNGs for the given style image ids (ignores unknown ids).
  static Future<void> ensureImagesById(
    StyleManager style, {
    required double devicePixelRatio,
    required Iterable<String> imageIds,
  }) async {
    final specs = <
      ({String sizeTier, num total, num active, num inactive, num neverBought})
    >[];
    for (final id in imageIds) {
      final parsed = tryParseImageId(id);
      if (parsed != null) specs.add(parsed);
    }
    if (specs.isEmpty) return;
    await ensureImages(
      style,
      devicePixelRatio: devicePixelRatio,
      specs: specs,
    );
  }

  static List<Object> _countKeyExpr(String property) => [
    'case',
    [
      '>',
      [
        'to-number',
        [
          'coalesce',
          ['get', property],
          0,
        ],
      ],
      _maxExact,
    ],
    '99p',
    [
      'to-string',
      [
        'to-number',
        [
          'coalesce',
          ['get', property],
          0,
        ],
      ],
    ],
  ];

  /// Fully data-driven id — images registered lazily via [ensureImages].
  static List<Object> get iconImageExpression => [
    'concat',
    imageIdPrefix,
    [
      'step',
      ['get', 'point_count'],
      's',
      10,
      'm',
      50,
      'l',
    ],
    '-t',
    [
      'case',
      [
        '>',
        ['get', 'point_count'],
        _maxExact,
      ],
      '99p',
      [
        'to-string',
        ['get', 'point_count'],
      ],
    ],
    '-a',
    _countKeyExpr('active'),
    '-i',
    _countKeyExpr('inactive'),
    '-n',
    _countKeyExpr('neverBought'),
  ];

  /// Warm cache + register a tiny fallback set (avoids blank first frame).
  static Future<void> ensureRegistered(
    StyleManager style, {
    required double devicePixelRatio,
  }) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    // Style reload drops images — always re-check style membership.
    _inStyle.clear();
    if (_registeredLayoutVersion != _layoutVersion ||
        (_registeredDpr - dpr).abs() > 0.01) {
      _cache.clear();
      _registeredDpr = dpr;
      _registeredLayoutVersion = _layoutVersion;
    }

    // Fallbacks: pure neverBought clusters for each size tier.
    final seeds = <({String tier, int total, int a, int i, int n})>[
      for (final tier in const ['s', 'm', 'l'])
        for (final n in const [1, 2, 3, 5, 10])
          (tier: tier, total: n, a: 0, i: 0, n: n),
    ];
    await ensureImages(
      style,
      devicePixelRatio: dpr,
      specs: [
        for (final s in seeds)
          (
            sizeTier: s.tier,
            total: s.total,
            active: s.a,
            inactive: s.i,
            neverBought: s.n,
          ),
      ],
    );
  }

  /// Paint + register any missing atomic pin images.
  static Future<void> ensureImages(
    StyleManager style, {
    required double devicePixelRatio,
    required Iterable<
      ({String sizeTier, num total, num active, num inactive, num neverBought})
    >
    specs,
  }) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    for (final spec in specs) {
      final id = imageId(
        sizeTier: spec.sizeTier,
        total: spec.total,
        active: spec.active,
        inactive: spec.inactive,
        neverBought: spec.neverBought,
      );
      if (_inStyle.contains(id)) continue;

      var painted = _cache[id];
      if (painted == null) {
        painted = await _paint(
          sizeTier: spec.sizeTier,
          dpr: dpr,
          totalLabel: countLabel(spec.total),
          activeLabel: countLabel(spec.active),
          inactiveLabel: countLabel(spec.inactive),
          neverBoughtLabel: countLabel(spec.neverBought),
        );
        _cache[id] = painted;
      }

      // Style reload drops images — re-add when missing.
      final existing = await style.getStyleImage(id);
      if (existing == null) {
        await style.addStyleImage(
          id,
          dpr,
          MbxImage(
            width: painted.width,
            height: painted.height,
            data: painted.bytes,
          ),
          false,
          [],
          [],
          null,
        );
      }
      _inStyle.add(id);
    }
  }

  static Future<({Uint8List bytes, int width, int height})> _paint({
    required String sizeTier,
    required double dpr,
    required String totalLabel,
    required String activeLabel,
    required String inactiveLabel,
    required String neverBoughtLabel,
  }) async {
    final layout = layoutFor(sizeTier);
    final colors = [activeColor, inactiveColor, neverBoughtColor];
    final labels = [activeLabel, inactiveLabel, neverBoughtLabel];

    final fontPx = layout.pillFontSize * dpr;
    final dotR = layout.dotR * dpr;
    final pillH = layout.pillH * dpr;
    final padX = layout.pillPadX * dpr;
    final gap = 6.0 * dpr;
    final pairGap = 3.5 * dpr;
    final stroke = layout.strokeWidth * dpr;
    final r = (layout.diameter / 2) * dpr;
    final overlap = layout.pillOverlap * dpr;

    final painters = [
      for (final label in labels)
        TextPainter(
          text: TextSpan(
            text: label,
            style: TextStyle(
              color: totalTextColor,
              fontSize: fontPx,
              fontWeight: FontWeight.w700,
              height: 1,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout(),
    ];

    var contentW = padX * 2;
    for (var i = 0; i < 3; i++) {
      if (i > 0) contentW += gap;
      contentW += dotR * 2 + pairGap + painters[i].width;
    }

    // Pill spills past disc — at least [pillMinExtra] wider, or content.
    final minPillW = r * 2 + layout.pillMinExtra * dpr;
    final pillW = contentW < minPillW ? minPillW : contentW;

    final edgePad = 8.0 * dpr;
    final shadowPad = 4.0 * dpr;
    final bodyW = pillW > r * 2 ? pillW : r * 2;
    final bodyH = r * 2 + pillH - overlap;
    final w = (bodyW + edgePad * 2 + shadowPad).ceil();
    final h = (bodyH + edgePad * 2 + shadowPad).ceil();

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(
      recorder,
      Rect.fromLTWH(0, 0, w.toDouble(), h.toDouble()),
    );

    final cx = w / 2;
    // Disc sits in the top half; pill hangs below and merges upward.
    final discCy = edgePad + shadowPad / 2 + r;
    final pillTop = discCy + r - overlap;
    final pillRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(cx - pillW / 2, pillTop, pillW, pillH),
      Radius.circular(pillH / 2),
    );

    final discPath = Path()
      ..addOval(Rect.fromCircle(center: Offset(cx, discCy), radius: r));
    final pillPath = Path()..addRRect(pillRect);
    final body = Path.combine(PathOperation.union, discPath, pillPath);

    canvas.drawPath(
      body.shift(Offset(0, 1.6 * dpr)),
      Paint()
        ..color = const Color(0x28000000)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, 2.4 * dpr),
    );
    // Translucent fill so map stays readable under clusters.
    canvas.drawPath(
      body,
      Paint()..color = Colors.white.withValues(alpha: 0.72),
    );
    canvas.drawPath(
      body,
      Paint()
        ..color = outlineColor.withValues(alpha: 0.85)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round,
    );

    final totalPainter = TextPainter(
      text: TextSpan(
        text: totalLabel,
        style: TextStyle(
          color: totalTextColor,
          fontSize: layout.totalFontSize * dpr,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    // Center total in the visible disc (above the pill merge).
    final totalCy = discCy - overlap * 0.15;
    totalPainter.paint(
      canvas,
      Offset(cx - totalPainter.width / 2, totalCy - totalPainter.height / 2),
    );
    totalPainter.dispose();

    var pairsW = 0.0;
    for (var i = 0; i < 3; i++) {
      if (i > 0) pairsW += gap;
      pairsW += dotR * 2 + pairGap + painters[i].width;
    }
    var x = cx - pairsW / 2;
    final midY = pillTop + pillH / 2;
    for (var i = 0; i < 3; i++) {
      if (i > 0) x += gap;
      canvas.drawCircle(
        Offset(x + dotR, midY),
        dotR,
        Paint()..color = colors[i],
      );
      x += dotR * 2 + pairGap;
      final tp = painters[i];
      tp.paint(canvas, Offset(x, midY - tp.height / 2));
      x += tp.width;
      tp.dispose();
    }

    final image = await recorder.endRecording().toImage(w, h);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    return (
      bytes: byteData?.buffer.asUint8List() ?? Uint8List(0),
      width: w,
      height: h,
    );
  }
}
