import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:atlasmed_mobile_app/features/explore/data/models/purchase_bucket.dart';
import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

/// Tear-drop clinic pins colored by Desempenho purchase bucket.
///
/// Register once per style via [ensureRegistered], then pick image via
/// [iconImageExpression] / [focusImageIdFor].
final class ClinicMapPin {
  ClinicMapPin._();

  static const activeImageId = 'atlasmed-clinic-pin-active';
  static const inactiveImageId = 'atlasmed-clinic-pin-inactive';
  static const neverBoughtImageId = 'atlasmed-clinic-pin-never';
  static const focusActiveImageId = 'atlasmed-clinic-pin-focus-active';
  static const focusInactiveImageId = 'atlasmed-clinic-pin-focus-inactive';
  static const focusNeverBoughtImageId = 'atlasmed-clinic-pin-focus-never';

  /// Legacy ids kept for nearby-map PointAnnotations.
  static const singleImageId = activeImageId;
  static const clusterImageId = activeImageId;
  static const focusImageId = focusActiveImageId;

  static const double singleLogicalWidth = 28;
  static const double singleLogicalHeight = 36;
  static const double focusLogicalWidth = 40;
  static const double focusLogicalHeight = 50;

  /// Same Desempenho / map chip palette (inactive = amber, not gray).
  static const Color activeFill = PurchaseBucketFilter.mapActiveColor;
  static const Color inactiveFill = PurchaseBucketFilter.mapInactiveColor;
  static const Color neverBoughtFill = PurchaseBucketFilter.mapNeverBoughtColor;

  /// Bump when pin chrome/colors change so style images rebuild.
  static const _paintVersion = 2;
  static int _registeredPaintVersion = 0;

  static Uint8List? _activeBytes;
  static Uint8List? _inactiveBytes;
  static Uint8List? _neverBytes;
  static Uint8List? _focusActiveBytes;
  static Uint8List? _focusInactiveBytes;
  static Uint8List? _focusNeverBytes;
  static double _cachedDpr = 0;
  static int _singlePxW = 0;
  static int _singlePxH = 0;
  static int _focusPxW = 0;
  static int _focusPxH = 0;

  static String imageIdFor(String? purchaseBucket, {bool focused = false}) {
    final bucket = purchaseBucket ?? PurchaseBucketFilter.neverBought;
    if (focused) {
      return switch (bucket) {
        PurchaseBucketFilter.active => focusActiveImageId,
        PurchaseBucketFilter.inactive => focusInactiveImageId,
        _ => focusNeverBoughtImageId,
      };
    }
    return switch (bucket) {
      PurchaseBucketFilter.active => activeImageId,
      PurchaseBucketFilter.inactive => inactiveImageId,
      _ => neverBoughtImageId,
    };
  }

  /// Mapbox expression: `focused` (1/0) + `purchaseBucket` → style image id.
  static List<Object> get iconImageExpression => [
        'case',
        [
          '==',
          ['get', 'focused'],
          1,
        ],
        [
          'match',
          ['get', 'purchaseBucket'],
          PurchaseBucketFilter.active,
          focusActiveImageId,
          PurchaseBucketFilter.inactive,
          focusInactiveImageId,
          focusNeverBoughtImageId,
        ],
        [
          'match',
          ['get', 'purchaseBucket'],
          PurchaseBucketFilter.active,
          activeImageId,
          PurchaseBucketFilter.inactive,
          inactiveImageId,
          neverBoughtImageId,
        ],
      ];

  static Future<void> ensureRegistered(
    StyleManager style, {
    required double devicePixelRatio,
  }) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if (_activeBytes == null ||
        _inactiveBytes == null ||
        _neverBytes == null ||
        _focusActiveBytes == null ||
        _focusInactiveBytes == null ||
        _focusNeverBytes == null ||
        _registeredPaintVersion != _paintVersion ||
        (_cachedDpr - dpr).abs() > 0.01) {
      _registeredPaintVersion = _paintVersion;
      await _rasterize(dpr);
    }

    Future<void> add(String id, Uint8List bytes, int w, int h) {
      return style.addStyleImage(
        id,
        dpr,
        MbxImage(width: w, height: h, data: bytes),
        false,
        [],
        [],
        null,
      );
    }

    await add(activeImageId, _activeBytes!, _singlePxW, _singlePxH);
    await add(inactiveImageId, _inactiveBytes!, _singlePxW, _singlePxH);
    await add(neverBoughtImageId, _neverBytes!, _singlePxW, _singlePxH);
    await add(focusActiveImageId, _focusActiveBytes!, _focusPxW, _focusPxH);
    await add(focusInactiveImageId, _focusInactiveBytes!, _focusPxW, _focusPxH);
    await add(
      focusNeverBoughtImageId,
      _focusNeverBytes!,
      _focusPxW,
      _focusPxH,
    );
  }

  static Future<Uint8List> singlePng({required double devicePixelRatio}) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if (_activeBytes == null || (_cachedDpr - dpr).abs() > 0.01) {
      await _rasterize(dpr);
    }
    return _activeBytes!;
  }

  static Future<Uint8List> clusterPng({
    required double devicePixelRatio,
  }) async {
    return singlePng(devicePixelRatio: devicePixelRatio);
  }

  static Future<Uint8List> focusPng({required double devicePixelRatio}) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if (_focusActiveBytes == null || (_cachedDpr - dpr).abs() > 0.01) {
      await _rasterize(dpr);
    }
    return _focusActiveBytes!;
  }

  static Future<Uint8List> pngForBucket(
    String purchaseBucket, {
    required double devicePixelRatio,
    bool focused = false,
  }) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if (_activeBytes == null || (_cachedDpr - dpr).abs() > 0.01) {
      await _rasterize(dpr);
    }
    if (focused) {
      return switch (purchaseBucket) {
        PurchaseBucketFilter.active => _focusActiveBytes!,
        PurchaseBucketFilter.inactive => _focusInactiveBytes!,
        _ => _focusNeverBytes!,
      };
    }
    return switch (purchaseBucket) {
      PurchaseBucketFilter.active => _activeBytes!,
      PurchaseBucketFilter.inactive => _inactiveBytes!,
      _ => _neverBytes!,
    };
  }

  static Future<void> _rasterize(double dpr) async {
    final active = await _paintPin(
      logicalWidth: singleLogicalWidth,
      logicalHeight: singleLogicalHeight,
      dpr: dpr,
      fill: activeFill,
    );
    final inactive = await _paintPin(
      logicalWidth: singleLogicalWidth,
      logicalHeight: singleLogicalHeight,
      dpr: dpr,
      fill: inactiveFill,
    );
    final never = await _paintPin(
      logicalWidth: singleLogicalWidth,
      logicalHeight: singleLogicalHeight,
      dpr: dpr,
      fill: neverBoughtFill,
    );
    final focusActive = await _paintPin(
      logicalWidth: focusLogicalWidth,
      logicalHeight: focusLogicalHeight,
      dpr: dpr,
      fill: activeFill,
      focused: true,
    );
    final focusInactive = await _paintPin(
      logicalWidth: focusLogicalWidth,
      logicalHeight: focusLogicalHeight,
      dpr: dpr,
      fill: inactiveFill,
      focused: true,
    );
    final focusNever = await _paintPin(
      logicalWidth: focusLogicalWidth,
      logicalHeight: focusLogicalHeight,
      dpr: dpr,
      fill: neverBoughtFill,
      focused: true,
    );

    _activeBytes = active.bytes;
    _inactiveBytes = inactive.bytes;
    _neverBytes = never.bytes;
    _singlePxW = active.width;
    _singlePxH = active.height;
    _focusActiveBytes = focusActive.bytes;
    _focusInactiveBytes = focusInactive.bytes;
    _focusNeverBytes = focusNever.bytes;
    _focusPxW = focusActive.width;
    _focusPxH = focusActive.height;
    _cachedDpr = dpr;
  }

  static Future<({Uint8List bytes, int width, int height})> _paintPin({
    required double logicalWidth,
    required double logicalHeight,
    required double dpr,
    required Color fill,
    bool focused = false,
  }) async {
    final w = (logicalWidth * dpr).ceil();
    final h = (logicalHeight * dpr).ceil();
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(
      recorder,
      Rect.fromLTWH(0, 0, w.toDouble(), h.toDouble()),
    );

    final cx = w / 2;
    final headR = w * 0.34;
    final headCy = headR + (focused ? 4.5 : 2.5) * dpr;
    final tipY = h - 1.5 * dpr;
    final strokeWidth = focused ? 2.8 : 2.0;

    final path = Path()
      ..moveTo(cx, tipY)
      ..cubicTo(
        cx - headR * 0.95,
        headCy + headR * 0.85,
        cx - headR,
        headCy + headR * 0.15,
        cx - headR,
        headCy,
      )
      ..arcToPoint(
        Offset(cx + headR, headCy),
        radius: Radius.circular(headR),
        clockwise: true,
      )
      ..cubicTo(
        cx + headR,
        headCy + headR * 0.15,
        cx + headR * 0.95,
        headCy + headR * 0.85,
        cx,
        tipY,
      )
      ..close();

    if (focused) {
      canvas.drawPath(
        path,
        Paint()
          ..color = fill.withValues(alpha: 0.35)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3.2 * dpr),
      );
    }

    canvas.drawPath(
      path.shift(Offset(0.6 * dpr, 1.2 * dpr)),
      Paint()
        ..color = const Color(0x55000000)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, 1.2 * dpr),
    );

    canvas.drawPath(path, Paint()..color = fill);
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth * dpr
        ..strokeJoin = StrokeJoin.round,
    );

    _paintHospitalIcon(
      canvas,
      center: Offset(cx, headCy),
      size: headR * 0.95,
      color: Colors.white.withValues(alpha: 0.95),
      dpr: dpr,
    );

    final image = await recorder.endRecording().toImage(w, h);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    return (
      bytes: byteData?.buffer.asUint8List() ?? Uint8List(0),
      width: w,
      height: h,
    );
  }

  static void _paintHospitalIcon(
    Canvas canvas, {
    required Offset center,
    required double size,
    required Color color,
    required double dpr,
  }) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(1.4 * dpr, size * 0.12)
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;

    final half = size * 0.42;
    final building = RRect.fromRectAndRadius(
      Rect.fromCenter(center: center, width: half * 1.55, height: half * 1.7),
      Radius.circular(1.2 * dpr),
    );
    canvas.drawRRect(building, paint);

    // Cross window
    final crossHalf = half * 0.28;
    final crossPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(1.2 * dpr, size * 0.1)
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      Offset(center.dx - crossHalf, center.dy - half * 0.15),
      Offset(center.dx + crossHalf, center.dy - half * 0.15),
      crossPaint,
    );
    canvas.drawLine(
      Offset(center.dx, center.dy - half * 0.15 - crossHalf),
      Offset(center.dx, center.dy - half * 0.15 + crossHalf),
      crossPaint,
    );
  }
}
