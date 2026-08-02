import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

/// Co-location count badge for nearby-radius map.
///
/// Fill = worst Desempenho bucket among stack members (neverBought > inactive
/// > active). Distinct from the current-clinic navy “you are here” ball.
final class NearbyStackMarker {
  NearbyStackMarker._();

  static const imageIdPrefix = 'atlasmed-nearby-stack-';
  static const _maxExact = 99;
  static const _paintVersion = 2;
  static int _registeredPaintVersion = 0;
  static double _registeredDpr = 0;
  static final Map<String, ({Uint8List bytes, int width, int height})> _cache =
      {};
  static final Set<String> _inStyle = {};

  static String imageId({required String bucket, required num count}) {
    final n = count.round().clamp(2, _maxExact + 1);
    final countKey = n > _maxExact ? '99p' : '$n';
    final b = PurchaseBucketFilter.values.contains(bucket)
        ? bucket
        : PurchaseBucketFilter.neverBought;
    return '$imageIdPrefix$b-$countKey';
  }

  static final _imageIdPattern = RegExp(
    r'^atlasmed-nearby-stack-([a-zA-Z_]+)-(\d+|99p)$',
  );

  static ({String bucket, num count})? tryParseImageId(String id) {
    final match = _imageIdPattern.firstMatch(id);
    if (match == null) return null;
    final bucket = match.group(1)!;
    final raw = match.group(2)!;
    final count = raw == '99p' ? _maxExact + 1 : num.parse(raw);
    return (bucket: bucket, count: count);
  }

  static Future<void> ensureImagesById(
    StyleManager style, {
    required double devicePixelRatio,
    required Iterable<String> imageIds,
  }) async {
    final specs = <({String bucket, num count})>[];
    for (final id in imageIds) {
      final parsed = tryParseImageId(id);
      if (parsed != null) specs.add(parsed);
    }
    if (specs.isEmpty) return;
    await ensureImages(style, devicePixelRatio: devicePixelRatio, specs: specs);
  }

  static String countLabel(num count) {
    final n = count.round();
    if (n > _maxExact) return '99+';
    return '$n';
  }

  /// Worst severity among [buckets]: neverBought > inactive > active.
  static String worstBucket(Iterable<String?> buckets) {
    var hasInactive = false;
    var hasActive = false;
    for (final raw in buckets) {
      final b = raw ?? PurchaseBucketFilter.neverBought;
      if (b == PurchaseBucketFilter.neverBought) {
        return PurchaseBucketFilter.neverBought;
      }
      if (b == PurchaseBucketFilter.inactive) {
        hasInactive = true;
      } else if (b == PurchaseBucketFilter.active) {
        hasActive = true;
      } else {
        return PurchaseBucketFilter.neverBought;
      }
    }
    if (hasInactive) return PurchaseBucketFilter.inactive;
    if (hasActive) return PurchaseBucketFilter.active;
    return PurchaseBucketFilter.neverBought;
  }

  static List<Object> get iconImageExpression => [
    'concat',
    imageIdPrefix,
    [
      'coalesce',
      ['get', 'purchaseBucket'],
      PurchaseBucketFilter.neverBought,
    ],
    '-',
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
  ];

  static Future<void> ensureImages(
    StyleManager style, {
    required double devicePixelRatio,
    required Iterable<({String bucket, num count})> specs,
  }) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if (_registeredPaintVersion != _paintVersion ||
        (_registeredDpr - dpr).abs() > 0.01) {
      _cache.clear();
      _inStyle.clear();
      _registeredDpr = dpr;
      _registeredPaintVersion = _paintVersion;
    }

    final needed = <({String bucket, num count})>{
      (bucket: PurchaseBucketFilter.neverBought, count: 2),
      ...specs,
    };

    for (final spec in needed) {
      if (spec.count < 2) continue;
      final id = imageId(bucket: spec.bucket, count: spec.count);
      if (_inStyle.contains(id)) {
        final existing = await style.getStyleImage(id);
        if (existing != null) continue;
        _inStyle.remove(id);
      }

      var painted = _cache[id];
      painted ??= await _paint(
        dpr: dpr,
        label: countLabel(spec.count),
        fill: PurchaseBucketFilter.mapColor(spec.bucket),
      );
      _cache[id] = painted;

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
    required double dpr,
    required String label,
    required Color fill,
  }) async {
    const logicalDiameter = 36.0;
    const strokeLogical = 3.0;
    final diameter = logicalDiameter * dpr;
    final stroke = strokeLogical * dpr;
    final pad = 4.0 * dpr;
    final w = (diameter + pad * 2).ceil();
    final h = w;

    final text = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          color: Colors.white,
          fontSize: (label.length > 2 ? 12 : 14) * dpr,
          fontWeight: FontWeight.w800,
          height: 1,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(
      recorder,
      Rect.fromLTWH(0, 0, w.toDouble(), h.toDouble()),
    );
    final c = Offset(w / 2, h / 2);
    final r = diameter / 2;

    canvas.drawCircle(
      c,
      r,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.12)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, 2 * dpr),
    );
    canvas.drawCircle(c, r - stroke / 2, Paint()..color = fill);
    canvas.drawCircle(
      c,
      r - stroke / 2,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke,
    );
    text.paint(canvas, Offset(c.dx - text.width / 2, c.dy - text.height / 2));

    final image = await recorder.endRecording().toImage(w, h);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    return (bytes: bytes!.buffer.asUint8List(), width: w, height: h);
  }
}
