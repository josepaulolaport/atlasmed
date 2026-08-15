import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:flutter_test/flutter_test.dart';

/// The reasons are the feature. A ranked list without them is a black box the
/// rep cannot argue with, so these assert that every sentence shown traces to a
/// component the server actually sent (spec 0016 §5.2).
void main() {
  group('buildReasons', () {
    test('names the orthopaedist count — the signal that ranks this book', () {
      final reasons = buildReasons({
        'c': {'raw': 0.9, 'weighted': 0.24, 'orthopaedists': 24},
      }, coverage: false);

      expect(reasons, contains('24 ortopedistas registrados aqui'));
    });

    test('adds the share when the clinic is mostly orthopaedic', () {
      // What separates a clinic from a hospital that employs a few
      // orthopaedists: ≥40% share converts at 32% against 11%.
      final reasons = buildReasons({
        'c': {
          'raw': 0.9,
          'weighted': 0.24,
          'orthopaedists': 24,
          'totalProfessionals': 25,
          'orthopaedistShare': 0.96,
        },
      }, coverage: false);

      expect(reasons, contains('24 ortopedistas registrados aqui — 96% do corpo clínico'));
    });

    test('omits the share when orthopaedists are a small part of a big staff', () {
      final reasons = buildReasons({
        'c': {
          'raw': 0.5,
          'weighted': 0.13,
          'orthopaedists': 3,
          'totalProfessionals': 120,
          'orthopaedistShare': 0.025,
        },
      }, coverage: false);

      expect(reasons, contains('3 ortopedistas registrados aqui'));
      expect(reasons.any((r) => r.contains('corpo clínico')), isFalse);
    });

    test('says "1 ortopedista" rather than "1 ortopedistas"', () {
      final reasons = buildReasons({
        'c': {'raw': 0.1, 'weighted': 0.02, 'orthopaedists': 1},
      }, coverage: false);

      expect(reasons, contains('1 ortopedista registrado aqui'));
    });

    test('omits capacity entirely when CNES records none', () {
      final reasons = buildReasons({
        'c': {'raw': 0.0, 'weighted': 0.0, 'orthopaedists': 0},
      }, coverage: false);

      expect(reasons.any((r) => r.contains('ortopedista')), isFalse);
    });

    test('counts down to the purchase window rather than naming a stage', () {
      // Two clinics in the same stage are not equally urgent — that distinction
      // is what the timing ramp exists for, so the card must show the days.
      final reasons = buildReasons({
        't': {
          'raw': 0.9,
          'weighted': 0.14,
          'stage': 'PURCHASE_WINDOW',
          'daysSinceLastPurchase': 27,
          'intervalDays': 30,
        },
      }, coverage: false);

      expect(reasons, contains('Entra na janela de compra em 3 dias'));
    });

    test('says how long a clinic has been overdue once the window has passed', () {
      final reasons = buildReasons({
        't': {
          'raw': 1.0,
          'weighted': 0.16,
          'stage': 'PURCHASE_WINDOW',
          'daysSinceLastPurchase': 40,
          'intervalDays': 30,
        },
      }, coverage: false);

      expect(reasons, contains('Na janela de compra há 10 dias'));
    });

    test('marks an unsurveyed clinic as unmeasured, never as zero potential', () {
      // Scoring the unknown as worthless would stop the engine ever sending a
      // rep to the clinics it knows least about — exactly backwards.
      final reasons = buildReasons({
        'h': {'raw': 0.4, 'weighted': 0.04, 'theirsQty': null, 'surveyed': false},
      }, coverage: false);

      expect(
        reasons,
        contains('Potencial não medido — vale levantar a concorrência'),
      );
    });

    test('quotes the competitor volume when it has been surveyed', () {
      final reasons = buildReasons({
        'h': {'raw': 0.8, 'weighted': 0.08, 'theirsQty': 80, 'surveyed': true},
      }, coverage: false);

      expect(reasons, contains('Concorrente com 80/mês aqui'));
    });

    test('says "ainda não visitada" for a coverage stop with no visit history', () {
      final reasons = buildReasons({
        'n': {'raw': 1.0, 'weighted': 0.12, 'daysSinceLastInteraction': null},
      }, coverage: true);

      expect(reasons, contains('Ainda não visitada'));
    });

    test('never returns an empty list — a stop without a reason cannot be shown', () {
      expect(buildReasons(const {}, coverage: false), isNotEmpty);
    });

    test('leads with capacity and timing, the components that rank this book', () {
      final reasons = buildReasons({
        'c': {'raw': 0.9, 'weighted': 0.24, 'orthopaedists': 24},
        't': {'raw': 0.5, 'weighted': 0.08, 'stage': 'NEVER_PURCHASED'},
        'h': {'raw': 0.4, 'weighted': 0.04, 'surveyed': false},
        'n': {'raw': 1.0, 'weighted': 0.12, 'daysSinceLastInteraction': 90},
      }, coverage: false);

      // A card renders only the first three, so ordering decides what a rep
      // actually reads.
      expect(reasons.first, '24 ortopedistas registrados aqui');
      expect(reasons[1], 'Nunca comprou');
    });
  });

  group('Roteiro.fromJson', () {
    test('reads stops, totals and notices', () {
      final roteiro = Roteiro.fromJson({
        'scopeDate': '2026-08-17',
        'reachMode': 'LIVRE',
        'reachBoundKm': 60,
        'travelSource': 'ESTIMATED',
        'notices': [
          {'code': 'QUOTA_UNFILLED', 'message': 'Sem clínicas em Manter.'},
        ],
        'totals': {'stops': 1, 'driveSeconds': 480, 'serviceMinutes': 45},
        'stops': [
          {
            'position': 0,
            'modality': 'IN_PERSON',
            'serviceMinutes': 45,
            'travelSecondsFromPrev': 480,
            'plannedStartsAt': '2026-08-17T11:30:00.000Z',
            'plannedEndsAt': '2026-08-17T12:15:00.000Z',
            'isCoverageSlot': true,
            'isAnchor': false,
            'candidate': {
              'facilityId': 12,
              'facilityVerticalProfileId': 34,
              'facilityName': 'Inst Cohen',
              'municipality': 'Sao Paulo',
              'bucket': 'PROSPECTAR',
              'straightLineKm': 10.2,
              'components': {
                'c': {'raw': 0.9, 'weighted': 0.24, 'orthopaedists': 24},
              },
            },
          },
        ],
      });

      expect(roteiro.isEstimated, isTrue);
      expect(roteiro.isAnchored, isFalse);
      expect(roteiro.stops.single.facilityName, 'Inst Cohen');
      expect(roteiro.stops.single.bucket, RoteiroBucket.prospectar);
      expect(roteiro.stops.single.isCoverageSlot, isTrue);
      expect(roteiro.stops.single.reasons, isNotEmpty);
      expect(roteiro.notices.single.code, 'QUOTA_UNFILLED');
      expect(roteiro.notices.single.isBlocking, isFalse);
      expect(roteiro.driveSeconds, 480);
    });

    test('treats NO_CANDIDATES as blocking and other notices as context', () {
      final roteiro = Roteiro.fromJson({
        'notices': [
          {'code': 'NO_CANDIDATES', 'message': 'Nada ao alcance.'},
          {'code': 'REACH_EXPANDED', 'message': 'Busca ampliada.'},
        ],
        'stops': const [],
      });

      expect(roteiro.notices.first.isBlocking, isTrue);
      expect(roteiro.notices.last.isBlocking, isFalse);
      expect(roteiro.stops, isEmpty);
    });

    test('a persisted DRAFT with stops can be confirmed', () {
      final roteiro = Roteiro.fromJson({
        'id': 12,
        'status': 'DRAFT',
        'stops': [
          {'position': 0, 'candidate': {'facilityName': 'X'}},
        ],
      });

      expect(roteiro.canConfirm, isTrue);
      expect(roteiro.isConfirmed, isFalse);
    });

    test('a preview cannot be confirmed — it was never persisted', () {
      final roteiro = Roteiro.fromJson({
        'id': null,
        'status': null,
        'stops': [
          {'position': 0, 'candidate': {'facilityName': 'X'}},
        ],
      });

      expect(roteiro.canConfirm, isFalse);
    });

    test('an empty slate cannot be confirmed', () {
      final roteiro = Roteiro.fromJson({'id': 12, 'status': 'DRAFT', 'stops': const []});

      expect(roteiro.canConfirm, isFalse);
    });

    test('a confirmed roteiro reports itself as on the agenda', () {
      final roteiro = Roteiro.fromJson({
        'id': 12,
        'status': 'CONFIRMED',
        'stops': [
          {'position': 0, 'candidate': {'facilityName': 'X'}},
        ],
      });

      expect(roteiro.isConfirmed, isTrue);
      expect(roteiro.canConfirm, isFalse);
    });

    test('survives a response missing every optional field', () {
      // Installed builds must not crash on a server that adds or drops keys.
      final roteiro = Roteiro.fromJson(const {});
      expect(roteiro.stops, isEmpty);
      expect(roteiro.isEstimated, isTrue);
    });
  });
}
