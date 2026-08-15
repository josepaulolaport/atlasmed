import 'package:atlasmed_mobile_app/features/map/presentation/utils/clinic_cluster_marker.dart';
import 'package:flutter_test/flutter_test.dart';

/// Cluster pin image ids.
///
/// The pins vanished and left their halo circles behind. A cluster is drawn by
/// two layers over one source: a CircleLayer halo, which needs no image, and a
/// SymbolLayer whose `icon-image` is built from the cluster's own counts. A
/// symbol whose image is not registered draws nothing — so the halo staying
/// while the pin disappeared says the image was missing, not the data.
///
/// The registry that decided "already registered" was one static Set shared by
/// every map in the app, while `addStyleImage` only ever registers into the one
/// style it is called on. Visiting the clinic-detail nearby map first was
/// enough to make the main map skip images it had never been given.

void main() {
  group('imageId', () {
    test('round-trips through the id the layer expression builds', () {
      final id = ClinicClusterMarker.imageId(
        sizeTier: 's',
        total: 3,
        active: 0,
        inactive: 3,
        neverBought: 0,
      );

      expect(id, 'atlasmed-cluster-s-t3-a0-i3-n0');

      // StyleImageMissing hands back exactly this string; if it cannot be
      // parsed the recovery path silently does nothing and the pin never
      // appears.
      final parsed = ClinicClusterMarker.tryParseImageId(id);
      expect(parsed, isNotNull);
      expect(parsed!.sizeTier, 's');
      expect(parsed.total, 3);
      expect(parsed.inactive, 3);
    });

    test('caps at 99p, and parses back to something paintable', () {
      final id = ClinicClusterMarker.imageId(
        sizeTier: 'l',
        total: 250,
        active: 120,
        inactive: 30,
        neverBought: 100,
      );

      expect(id, 'atlasmed-cluster-l-t99p-a99p-i30-n99p');

      final parsed = ClinicClusterMarker.tryParseImageId(id)!;
      // 100 stands for "more than we print exactly" — the label becomes 99+.
      expect(parsed.total, 100);
      expect(ClinicClusterMarker.countLabel(parsed.total), '99+');
      expect(parsed.inactive, 30);
    });

    test('rejects an id that is not ours', () {
      expect(
        ClinicClusterMarker.tryParseImageId('atlasmed-clinic-pin'),
        isNull,
      );
      expect(ClinicClusterMarker.tryParseImageId('atlasmed-cluster-x'), isNull);
      // Malformed counts must not parse: half an id would paint a wrong pin.
      expect(
        ClinicClusterMarker.tryParseImageId('atlasmed-cluster-s-t3-a0-i3'),
        isNull,
      );
    });
  });

  group('size tier', () {
    test('matches the step expression the layer uses', () {
      // The layer picks the tier with ['step', point_count, 's', 10, 'm', 50,
      // 'l']. If these two disagree the id built at render time names an image
      // that was registered under a different tier — and nothing draws.
      expect(ClinicClusterMarker.sizeTierForCount(2), 's');
      expect(ClinicClusterMarker.sizeTierForCount(9), 's');
      expect(ClinicClusterMarker.sizeTierForCount(10), 'm');
      expect(ClinicClusterMarker.sizeTierForCount(49), 'm');
      expect(ClinicClusterMarker.sizeTierForCount(50), 'l');
      expect(ClinicClusterMarker.sizeTierForCount(500), 'l');
    });

    test('the expression carries the same boundaries', () {
      final expression = ClinicClusterMarker.iconImageExpression;
      final step = expression.firstWhere(
        (part) => part is List && part.isNotEmpty && part.first == 'step',
      );

      expect(step, [
        'step',
        ['get', 'point_count'],
        's',
        10,
        'm',
        50,
        'l',
      ]);
    });
  });

  group('count keys', () {
    test('a missing count is zero, not absent', () {
      // The expression coalesces a missing property to 0; the Dart side must
      // agree or the two build different ids for the same cluster.
      expect(ClinicClusterMarker.countKey(null), '0');
      expect(ClinicClusterMarker.countKey(0), '0');
    });

    test('rounds rather than printing a decimal', () {
      // Cluster accumulators produce doubles. "3.0" in an id would not match
      // the pattern, and the pin would never be recovered.
      expect(ClinicClusterMarker.countKey(3.0), '3');
      expect(ClinicClusterMarker.countKey(2.6), '3');
      expect(
        ClinicClusterMarker.imageId(
          sizeTier: 's',
          total: 3.0,
          active: 1.0,
          inactive: 2.0,
          neverBought: 0.0,
        ),
        'atlasmed-cluster-s-t3-a1-i2-n0',
      );
    });

    test('a negative count clamps rather than producing "-1"', () {
      expect(ClinicClusterMarker.countKey(-1), '0');
    });
  });
}
