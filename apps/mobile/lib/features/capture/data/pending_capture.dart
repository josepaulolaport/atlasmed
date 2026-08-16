import 'dart:convert';

import 'package:equatable/equatable.dart';

/// What the rep pressed. The queue replays each kind through its own endpoint.
enum PendingCaptureKind {
  arrival('arrival'),
  start('start'),
  complete('complete');

  const PendingCaptureKind(this.wire);

  final String wire;

  static PendingCaptureKind fromWire(String value) =>
      PendingCaptureKind.values.firstWhere((kind) => kind.wire == value);
}

/// The server refuses a stamp older than this — spec 0016 §15.6.6-4.
///
/// Held here as well so the queue can stop retrying something it knows will be
/// refused, and say so, instead of failing against the server once an hour
/// until the rep gives up on it.
const kCaptureStampMaxAge = Duration(hours: 24);

/// A capture the rep made while the app could not reach the server.
///
/// The stamp is the point of the whole thing. §15.6.6-4: the server used to
/// stamp receipt time, so a visit recorded in a clinic with no signal was
/// written down as having started whenever the queue happened to drain. The
/// entry carries the instant the rep actually pressed, and replay sends that.
class PendingCapture extends Equatable {
  const PendingCapture({
    required this.id,
    required this.kind,
    required this.stampedAt,
    required this.label,
    required this.payload,
    this.attempts = 0,
    this.lastError,
  });

  /// Doubles as the idempotency key.
  ///
  /// One key per press, minted when the press happens and persisted with it, so
  /// a replay that already reached the server the first time is recognised as a
  /// replay rather than recorded twice.
  final String id;

  final PendingCaptureKind kind;

  /// When the rep pressed — never when the entry was replayed.
  final DateTime stampedAt;

  /// What to call this in a list the rep reads. "Cheguei · Clínica Central".
  final String label;

  /// The request body, minus the stamp, which [stampedAt] owns.
  final Map<String, dynamic> payload;

  final int attempts;
  final String? lastError;

  bool isExpiredAt(DateTime now) =>
      now.difference(stampedAt) > kCaptureStampMaxAge;

  PendingCapture withFailure(String error) => PendingCapture(
    id: id,
    kind: kind,
    stampedAt: stampedAt,
    label: label,
    payload: payload,
    attempts: attempts + 1,
    lastError: error,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'kind': kind.wire,
    'stampedAt': stampedAt.toUtc().toIso8601String(),
    'label': label,
    'payload': payload,
    'attempts': attempts,
    if (lastError != null) 'lastError': lastError,
  };

  factory PendingCapture.fromJson(Map<String, dynamic> json) => PendingCapture(
    id: json['id'] as String,
    kind: PendingCaptureKind.fromWire(json['kind'] as String),
    stampedAt: DateTime.parse(json['stampedAt'] as String).toUtc(),
    label: json['label'] as String,
    payload: Map<String, dynamic>.from(json['payload'] as Map),
    attempts: (json['attempts'] as num?)?.toInt() ?? 0,
    lastError: json['lastError'] as String?,
  );

  String toRawJson() => jsonEncode(toJson());

  factory PendingCapture.fromRawJson(String raw) =>
      PendingCapture.fromJson(jsonDecode(raw) as Map<String, dynamic>);

  @override
  List<Object?> get props => [
    id,
    kind,
    stampedAt,
    label,
    payload,
    attempts,
    lastError,
  ];
}
