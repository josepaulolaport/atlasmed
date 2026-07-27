import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Tear-drop clinic pins for Mapbox (no built-in pin shape — we rasterize).
///
/// Register once per style via [ensureRegistered], then reference
/// [singleImageId] / [clusterImageId] / [focusImageId] from SymbolLayers or
/// PointAnnotations.
final class ClinicMapPin {
  ClinicMapPin._();

  static const singleImageId = 'atlasmed-clinic-pin';
  static const clusterImageId = 'atlasmed-clinic-pin-cluster';
  static const focusImageId = 'atlasmed-clinic-pin-focus';

  /// Logical size of the single pin (tip at bottom center).
  static const double singleLogicalWidth = 28;
  static const double singleLogicalHeight = 36;

  /// Larger cluster pin — different colour + size so clusters read clearly.
  static const double clusterLogicalWidth = 34;
  static const double clusterLogicalHeight = 44;

  /// Current/focus clinic — same footprint as cluster, distinct colour + mark.
  static const double focusLogicalWidth = 36;
  static const double focusLogicalHeight = 46;

  static const Color singleFill = AppColors.green;
  static const Color clusterFill = Color(0xFF1d4ed8);

  /// Amber focus pin so the current clinic reads apart from green/blue pins.
  static const Color focusFill = Color(0xFFEA580C);

  static Uint8List? _singleBytes;
  static Uint8List? _clusterBytes;
  static Uint8List? _focusBytes;
  static double _cachedDpr = 0;
  static int _singlePxW = 0;
  static int _singlePxH = 0;
  static int _clusterPxW = 0;
  static int _clusterPxH = 0;
  static int _focusPxW = 0;
  static int _focusPxH = 0;

  static Future<void> ensureRegistered(
    StyleManager style, {
    required double devicePixelRatio,
  }) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if (_singleBytes == null ||
        _clusterBytes == null ||
        _focusBytes == null ||
        (_cachedDpr - dpr).abs() > 0.01) {
      await _rasterize(dpr);
    }

    await style.addStyleImage(
      singleImageId,
      dpr,
      MbxImage(width: _singlePxW, height: _singlePxH, data: _singleBytes!),
      false,
      [],
      [],
      null,
    );
    await style.addStyleImage(
      clusterImageId,
      dpr,
      MbxImage(width: _clusterPxW, height: _clusterPxH, data: _clusterBytes!),
      false,
      [],
      [],
      null,
    );
    await style.addStyleImage(
      focusImageId,
      dpr,
      MbxImage(width: _focusPxW, height: _focusPxH, data: _focusBytes!),
      false,
      [],
      [],
      null,
    );
  }

  /// PNG bytes for PointAnnotation usage (nearby map).
  static Future<Uint8List> singlePng({required double devicePixelRatio}) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if (_singleBytes == null || (_cachedDpr - dpr).abs() > 0.01) {
      await _rasterize(dpr);
    }
    return _singleBytes!;
  }

  static Future<Uint8List> clusterPng({
    required double devicePixelRatio,
  }) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if (_clusterBytes == null || (_cachedDpr - dpr).abs() > 0.01) {
      await _rasterize(dpr);
    }
    return _clusterBytes!;
  }

  static Future<Uint8List> focusPng({required double devicePixelRatio}) async {
    final dpr = devicePixelRatio.clamp(1.0, 3.0);
    if (_focusBytes == null || (_cachedDpr - dpr).abs() > 0.01) {
      await _rasterize(dpr);
    }
    return _focusBytes!;
  }

  static Future<void> _rasterize(double dpr) async {
    final single = await _paintPin(
      logicalWidth: singleLogicalWidth,
      logicalHeight: singleLogicalHeight,
      dpr: dpr,
      fill: singleFill,
    );
    final cluster = await _paintPin(
      logicalWidth: clusterLogicalWidth,
      logicalHeight: clusterLogicalHeight,
      dpr: dpr,
      fill: clusterFill,
    );
    final focus = await _paintPin(
      logicalWidth: focusLogicalWidth,
      logicalHeight: focusLogicalHeight,
      dpr: dpr,
      fill: focusFill,
      innerMark: _PinInnerMark.star,
      strokeWidth: 2.4,
    );
    _singleBytes = single.bytes;
    _singlePxW = single.width;
    _singlePxH = single.height;
    _clusterBytes = cluster.bytes;
    _clusterPxW = cluster.width;
    _clusterPxH = cluster.height;
    _focusBytes = focus.bytes;
    _focusPxW = focus.width;
    _focusPxH = focus.height;
    _cachedDpr = dpr;
  }

  static Future<({Uint8List bytes, int width, int height})> _paintPin({
    required double logicalWidth,
    required double logicalHeight,
    required double dpr,
    required Color fill,
    _PinInnerMark innerMark = _PinInnerMark.dot,
    double strokeWidth = 2.0,
  }) async {
    final w = (logicalWidth * dpr).ceil();
    final h = (logicalHeight * dpr).ceil();
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(
      recorder,
      Rect.fromLTWH(0, 0, w.toDouble(), h.toDouble()),
    );

    final cx = w / 2;
    final headR = w * 0.36;
    final headCy = headR + 2 * dpr;
    final tipY = h - 1.5 * dpr;

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

    // Soft drop shadow
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

    switch (innerMark) {
      case _PinInnerMark.dot:
        canvas.drawCircle(
          Offset(cx, headCy),
          headR * 0.32,
          Paint()..color = Colors.white.withValues(alpha: 0.92),
        );
      case _PinInnerMark.star:
        final star = _starPath(
          center: Offset(cx, headCy),
          outerR: headR * 0.42,
          innerR: headR * 0.18,
        );
        canvas.drawPath(
          star,
          Paint()..color = Colors.white.withValues(alpha: 0.95),
        );
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

  static Path _starPath({
    required Offset center,
    required double outerR,
    required double innerR,
  }) {
    const points = 5;
    final path = Path();
    for (var i = 0; i < points * 2; i++) {
      final r = i.isEven ? outerR : innerR;
      final angle = -math.pi / 2 + (i * math.pi / points);
      final x = center.dx + r * math.cos(angle);
      final y = center.dy + r * math.sin(angle);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();
    return path;
  }
}

enum _PinInnerMark { dot, star }
