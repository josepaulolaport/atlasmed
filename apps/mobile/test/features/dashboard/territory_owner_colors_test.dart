import 'package:atlasmed_mobile_app/features/dashboard/data/models/dashboard_metrics.dart';
import 'package:atlasmed_mobile_app/features/dashboard/presentation/widgets/dashboard_territory_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// An admin's território card draws several people's zones.
///
/// It used to draw every zone in the linha in one flat blue, so a rep patch
/// nested inside a manager's zone painted the same colour twice and the darker
/// overlap read as a data signal it was not. The API now sends only the zones
/// of whoever the filters selected, and each carries its owner, so the card can
/// colour by responsável.
DashboardTerritoryFeature zone(int id, {int? ownerId, String? ownerName}) =>
    DashboardTerritoryFeature(
      id: id,
      name: 'Zona $id',
      ownerId: ownerId,
      ownerName: ownerName,
    );

void main() {
  test('gives each responsável a colour of their own', () {
    final colors = ownerColors([
      zone(1, ownerId: 7),
      zone(2, ownerId: 9),
      zone(3, ownerId: 7),
    ]);

    expect(colors.keys.toSet(), {7, 9});
    expect(colors[7], isNot(colors[9]));
  });

  test('does not depend on the order the API returned the zones in', () {
    // Two responses describing the same people must colour them the same way,
    // or a refresh would repaint the map for no reason the reader can see.
    final ascending = ownerColors([zone(1, ownerId: 4), zone(2, ownerId: 11)]);
    final descending = ownerColors([zone(2, ownerId: 11), zone(1, ownerId: 4)]);

    expect(descending, ascending);
  });

  test('keeps every responsável distinct up to the palette length', () {
    // The distinctness is the point, and it is what the assignment optimises
    // for: colours are handed out by position, so a filter that removes one
    // person does shift the rest. That repaint is the accepted cost of never
    // showing two zones on screen in the same colour.
    final colors = ownerColors([
      for (var i = 0; i < 8; i++) zone(i, ownerId: i * 3),
    ]);

    expect(colors.values.toSet().length, 8);
  });

  test('ignores zones with no owner rather than colouring them', () {
    // The API does not send unassigned zones any more. If one ever arrives it
    // must not consume a responsável's colour.
    final colors = ownerColors([zone(1, ownerId: null), zone(2, ownerId: 3)]);

    expect(colors.keys.toList(), [3]);
  });

  test('runs out of palette by repeating, never by throwing', () {
    final many = [for (var i = 0; i < 20; i++) zone(i, ownerId: i)];
    final colors = ownerColors(many);

    expect(colors.length, 20);
    expect(colors.values.whereType<Color>().length, 20);
  });

  test('has no colour to give when nothing is owned', () {
    expect(ownerColors(const []), isEmpty);
  });
}
