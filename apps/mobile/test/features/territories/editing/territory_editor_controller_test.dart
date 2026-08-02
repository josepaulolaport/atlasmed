import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart'
    show TerritoryGeometry;
import 'package:atlasmed_mobile_app/features/territories/data/models/assignable_manager.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/boundary_impact.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/business_vertical.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_draft.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/unassigned_facility.dart';
import 'package:atlasmed_mobile_app/features/territories/data/repositories/territory_repository.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/geometry/geometry_ops.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_mode.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_refs.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/models/editor_target.dart';
import 'package:atlasmed_mobile_app/features/territories/editing/providers/territory_editor_controller.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

MapCoordinate _c(double lng, double lat) =>
    MapCoordinate(longitude: lng, latitude: lat);

const _managerZoneType = TerritoryType(
  id: 'type-1',
  slug: 'manager_zone',
  name: 'Zona de gerente',
  assignsClinics: false,
  assignableToManagers: true,
);

const _repPatchType = TerritoryType(
  id: 'type-2',
  slug: 'patch',
  name: 'Área de representante',
  assignsClinics: true,
  assignableToManagers: false,
);

Territory _territory({required String id, required List<MapCoordinate> ring}) {
  final geometry = TerritoryGeometry.polygon([
    [...ring, ring.first],
  ]);
  return Territory(
    id: id,
    name: 'Território $id',
    slug: id,
    code: id,
    verticalId: 'vertical-oncologia',
    territoryType: _managerZoneType,
    boundary: geometry,
    centroid: ring.first,
  );
}

class _FakeTerritoryRepository implements TerritoryRepository {
  _FakeTerritoryRepository(List<Territory> seed)
    : territories = List<Territory>.of(seed);

  final List<Territory> territories;
  TerritoryGeometry? lastSavedGeometry;
  String? lastSavedId;
  TerritoryDraft? lastCreatedDraft;
  String? lastDeletedId;

  @override
  Future<List<BusinessVertical>> getVerticals() async => const [];

  @override
  Future<Territory?> getTerritoryById(String id) async {
    for (final territory in territories) {
      if (territory.id == id) return territory;
    }
    return null;
  }

  @override
  Future<List<Territory>> getTerritories({
    required String territoryTypeSlug,
    String? verticalId,
  }) async {
    return territories
        .where(
          (t) =>
              t.territoryType.slug == territoryTypeSlug &&
              (verticalId == null || t.verticalId == verticalId),
        )
        .toList();
  }

  @override
  Future<BoundaryImpactPreview> previewBoundaryImpact(
    String id,
    TerritoryGeometry geometry,
  ) async {
    return const BoundaryImpactPreview(mode: 'none', clinics: []);
  }

  @override
  Future<void> updateTerritoryGeometry(
    String id,
    TerritoryGeometry geometry, {
    List<String>? acceptedFacilityIds,
  }) async {
    lastSavedId = id;
    lastSavedGeometry = geometry;
    final index = territories.indexWhere((t) => t.id == id);
    if (index != -1) {
      territories[index] = territories[index].copyWith(boundary: geometry);
    }
  }

  @override
  Future<List<UnassignedFacility>> listUnassignedFacilities({
    String? managerZoneId,
    int page = 1,
    int limit = 50,
  }) async =>
      const [];

  @override
  Future<Territory> createTerritory(
    TerritoryDraft draft,
    TerritoryGeometry boundary,
    MapCoordinate centroid,
  ) async {
    lastCreatedDraft = draft;
    final territory = Territory(
      id: 'created-${territories.length}',
      name: draft.name,
      slug: draft.name,
      code: draft.name,
      verticalId: draft.verticalId,
      territoryType: draft.kind == TerritoryKind.managerZone
          ? _managerZoneType
          : _repPatchType,
      managerTerritoryId: draft.managerTerritoryId,
      boundary: boundary,
      centroid: centroid,
    );
    territories.add(territory);
    return territory;
  }

  @override
  Future<void> deleteTerritory(String id) async {
    lastDeletedId = id;
    territories.removeWhere((t) => t.id == id);
  }

  @override
  Future<void> assignUser(String territoryId, String? userId) async {
    final index = territories.indexWhere((t) => t.id == territoryId);
    if (index == -1) return;
    territories[index] = territories[index].copyWith(assignedUserId: userId);
  }

  @override
  Future<void> updateTerritoryInfo(
    String territoryId, {
    required String name,
    required bool isActive,
    String? managerTerritoryId,
  }) async {
    final index = territories.indexWhere((t) => t.id == territoryId);
    if (index == -1) return;
    territories[index] = territories[index].copyWith(
      name: name,
      isActive: isActive,
      managerTerritoryId: managerTerritoryId,
    );
  }

  @override
  Future<List<AssignableManager>> getAssignableManagers({
    String? verticalId,
  }) async {
    return const [];
  }
}

void main() {
  late _FakeTerritoryRepository repository;
  late ProviderContainer container;

  final square = [_c(0, 0), _c(2, 0), _c(2, 2), _c(0, 2)];
  final neighborSquare = [_c(10, 10), _c(12, 10), _c(12, 12), _c(10, 12)];

  setUp(() {
    repository = _FakeTerritoryRepository([
      _territory(id: 'target', ring: square),
      _territory(id: 'neighbor', ring: neighborSquare),
    ]);
    container = ProviderContainer(
      overrides: [territoryRepositoryProvider.overrideWithValue(repository)],
    );
  });

  tearDown(() => container.dispose());

  Future<TerritoryEditorController> loadController() async {
    // `autoDispose` providers are torn down once their listener count hits
    // zero — keep one alive for the life of the test so repeated `read`s
    // all see the same controller instance.
    container.listen(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('target'),
      ),
      (previous, next) {},
    );
    final controller = container.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('target'),
      ).notifier,
    );
    await Future.doWhile(() async {
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return container
          .read(
            territoryEditorControllerProvider(
              TerritoryEditorTarget.existing('target'),
            ),
          )
          .loading;
    });
    return controller;
  }

  test(
    'loads the target territory and excludes it from its own neighbors',
    () async {
      await loadController();
      final state = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ),
      );

      expect(state.loadError, isNull);
      expect(state.original?.id, 'target');
      expect(state.neighbors.map((t) => t.id), ['neighbor']);
      expect(state.working, [
        [square],
      ]);
      expect(state.isDirty, isFalse);
      expect(state.canSave, isFalse);
    },
  );

  test('dragging a vertex is undo-able and marks the state dirty', () async {
    await loadController();
    final controller = container.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('target'),
      ).notifier,
    );
    const vertexRef = VertexRef(partIndex: 0, ringIndex: 0, pointIndex: 0);

    controller.beginVertexDrag(vertexRef);
    controller.updateVertexDrag(vertexRef, _c(-1, -1));
    controller.endVertexDrag();

    var state = container.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('target'),
      ),
    );
    expect(state.working![0][0][0], _c(-1, -1));
    expect(state.isDirty, isTrue);
    expect(state.canSave, isTrue);

    controller.undo();
    state = container.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('target'),
      ),
    );
    expect(state.working![0][0][0], _c(0, 0));
    expect(state.isDirty, isFalse);
  });

  test(
    'flags overlap with a same-kind/sector neighbor live, then auto-clips it on release',
    () async {
      await loadController();
      final controller = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ).notifier,
      );
      const vertexRef = VertexRef(partIndex: 0, ringIndex: 0, pointIndex: 2);

      controller.beginVertexDrag(vertexRef);
      // Drags the (2,2) corner into the neighbor square at (10..12, 10..12).
      controller.updateVertexDrag(vertexRef, _c(11, 11));

      var state = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ),
      );
      expect(state.validation.overlapsNeighbor, isTrue);
      expect(state.canSave, isFalse);

      // Stage 3: releasing the drag auto-clips the overlap away instead
      // of just leaving it flagged — the boundary "snaps" to the
      // neighbor's border.
      controller.endVertexDrag();
      state = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ),
      );
      expect(state.validation.overlapsNeighbor, isFalse);
      expect(
        state.working!.any(
          (part) => GeometryOps.intersects(part.first, neighborSquare),
        ),
        isFalse,
      );
    },
  );

  test(
    'drops a stale selection when auto-clip-to-neighbor reshapes the '
    'working geometry, instead of leaving it pointing at the wrong part',
    () async {
      await loadController();
      final controller = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ).notifier,
      );
      controller.setMode(EditorMode.select);
      controller.selectPart(0);
      controller.chooseSelectionAction(SelectionAction.boundary);

      const vertexRef = VertexRef(partIndex: 0, ringIndex: 0, pointIndex: 2);
      controller.beginVertexDrag(vertexRef);
      controller.updateVertexDrag(vertexRef, _c(11, 11));
      controller.endVertexDrag(); // auto-clips against the neighbor

      final state = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ),
      );
      expect(state.selectedPart, isNull);
      expect(state.selectionAction, SelectionAction.none);
    },
  );

  test('add area tool unions a drawn shape into the target', () async {
    await loadController();
    final controller = container.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('target'),
      ).notifier,
    );

    controller.setMode(EditorMode.addArea);
    expect(controller.addDrawingPoint(_c(1, 0)), isTrue);
    expect(controller.addDrawingPoint(_c(4, 0)), isTrue);
    expect(controller.addDrawingPoint(_c(4, 2)), isTrue);
    expect(controller.addDrawingPoint(_c(1, 2)), isTrue);

    expect(controller.finishDrawing(), isTrue);
    final state = container.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('target'),
      ),
    );
    expect(state.mode, EditorMode.select);
    // Merged into a single, larger part rather than appended separately.
    expect(state.working!.length, 1);
    expect(state.isDirty, isTrue);
  });

  test(
    'remove area tool cuts a hole when the drawn ring is interior',
    () async {
      await loadController();
      final controller = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ).notifier,
      );

      controller.setMode(EditorMode.removeArea);
      expect(controller.addDrawingPoint(_c(0.5, 0.5)), isTrue);
      expect(controller.addDrawingPoint(_c(1.5, 0.5)), isTrue);
      expect(controller.addDrawingPoint(_c(1.5, 1.5)), isTrue);
      expect(controller.addDrawingPoint(_c(0.5, 1.5)), isTrue);

      expect(controller.finishDrawing(), isTrue);
      final state = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ),
      );
      expect(state.mode, EditorMode.select);
      expect(state.working!.length, 1);
      expect(state.working![0].length, 2); // exterior ring + hole
      expect(state.isDirty, isTrue);
    },
  );

  test(
    'add area tool rejects a shape that does not touch the existing territory',
    () async {
      await loadController();
      final controller = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ).notifier,
      );

      controller.setMode(EditorMode.addArea);
      expect(controller.addDrawingPoint(_c(20, 0)), isTrue);
      expect(controller.addDrawingPoint(_c(21, 0)), isTrue);
      expect(controller.addDrawingPoint(_c(21, 1)), isTrue);
      expect(controller.addDrawingPoint(_c(20, 1)), isTrue);

      expect(controller.finishDrawing(), isFalse);
      final state = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ),
      );
      expect(state.mode, EditorMode.addArea);
      expect(state.working, [
        [square],
      ]);
      expect(state.isDirty, isFalse);
      expect(state.validation.hasMultipleAreas, isTrue);
    },
  );

  test('remove area tool rejects a cut that would split the territory into '
      'two disconnected parts', () async {
    await loadController();
    final controller = container.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('target'),
      ).notifier,
    );

    controller.setMode(EditorMode.removeArea);
    // A thin vertical strip through the middle of the target square
    // ((0,0)-(2,2)), extending past both edges — bisects it into a left
    // and a right piece instead of just cutting a hole.
    expect(controller.addDrawingPoint(_c(0.9, -1)), isTrue);
    expect(controller.addDrawingPoint(_c(1.1, -1)), isTrue);
    expect(controller.addDrawingPoint(_c(1.1, 3)), isTrue);
    expect(controller.addDrawingPoint(_c(0.9, 3)), isTrue);

    expect(controller.finishDrawing(), isFalse);
    final state = container.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('target'),
      ),
    );
    expect(state.mode, EditorMode.removeArea);
    expect(state.working, [
      [square],
    ]);
    expect(state.isDirty, isFalse);
    expect(state.validation.hasMultipleAreas, isTrue);
  });

  test('flags a pre-existing multi-part boundary as invalid and blocks save '
      'until merged back into one polygon', () async {
    final legacySquareA = [_c(0, 0), _c(2, 0), _c(2, 2), _c(0, 2)];
    final legacySquareB = [_c(5, 5), _c(7, 5), _c(7, 7), _c(5, 7)];
    final legacyRepository = _FakeTerritoryRepository([
      Territory(
        id: 'legacy',
        name: 'Território legado',
        slug: 'legacy',
        code: 'legacy',
        verticalId: 'vertical-oncologia',
        territoryType: _managerZoneType,
        boundary: TerritoryGeometry.multiPolygon([
          [
            [...legacySquareA, legacySquareA.first],
          ],
          [
            [...legacySquareB, legacySquareB.first],
          ],
        ]),
        centroid: legacySquareA.first,
      ),
    ]);
    final legacyContainer = ProviderContainer(
      overrides: [
        territoryRepositoryProvider.overrideWithValue(legacyRepository),
      ],
    );
    addTearDown(legacyContainer.dispose);
    legacyContainer.listen(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('legacy'),
      ),
      (previous, next) {},
    );
    final controller = legacyContainer.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('legacy'),
      ).notifier,
    );
    await Future.doWhile(() async {
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return legacyContainer
          .read(
            territoryEditorControllerProvider(
              TerritoryEditorTarget.existing('legacy'),
            ),
          )
          .loading;
    });

    var state = legacyContainer.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('legacy'),
      ),
    );
    expect(state.working!.length, 2);
    expect(state.validation.hasMultipleAreas, isTrue);

    // Dirty the state (drag a vertex) to confirm the multi-area flag —
    // not just "nothing changed yet" — is what's blocking save.
    const vertexRef = VertexRef(partIndex: 0, ringIndex: 0, pointIndex: 0);
    controller.beginVertexDrag(vertexRef);
    controller.updateVertexDrag(vertexRef, _c(-1, -1));
    controller.endVertexDrag();

    state = legacyContainer.read(
      territoryEditorControllerProvider(
        TerritoryEditorTarget.existing('legacy'),
      ),
    );
    expect(state.isDirty, isTrue);
    expect(state.validation.hasMultipleAreas, isTrue);
    expect(state.canSave, isFalse);
  });

  test(
    'remove area tool refuses a cut that would eliminate the territory',
    () async {
      await loadController();
      final controller = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ).notifier,
      );

      controller.setMode(EditorMode.removeArea);
      expect(controller.addDrawingPoint(_c(-1, -1)), isTrue);
      expect(controller.addDrawingPoint(_c(3, -1)), isTrue);
      expect(controller.addDrawingPoint(_c(3, 3)), isTrue);
      expect(controller.addDrawingPoint(_c(-1, 3)), isTrue);

      expect(controller.finishDrawing(), isFalse);
      final state = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ),
      );
      expect(state.mode, EditorMode.removeArea);
      expect(state.working, [
        [square],
      ]);
      expect(state.isDirty, isFalse);
      expect(state.validation.isValid, isFalse);
    },
  );

  test(
    'save persists the working geometry and clears the undo stack',
    () async {
      await loadController();
      final controller = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ).notifier,
      );
      const vertexRef = VertexRef(partIndex: 0, ringIndex: 0, pointIndex: 0);
      controller.beginVertexDrag(vertexRef);
      controller.updateVertexDrag(vertexRef, _c(-1, -1));
      controller.endVertexDrag();

      final saved = await controller.save();
      expect(saved, isTrue);
      expect(repository.lastSavedId, 'target');
      expect(repository.lastSavedGeometry!.coordinates[0][0][0], _c(-1, -1));

      final state = container.read(
        territoryEditorControllerProvider(
          TerritoryEditorTarget.existing('target'),
        ),
      );
      expect(state.isDirty, isFalse);
      expect(state.saved, isTrue);
    },
  );

  group('creating a new territory', () {
    const creatingTarget = TerritoryEditorTarget.creating(
      initialKind: TerritoryKind.managerZone,
    );

    Future<TerritoryEditorController> loadCreatingController() async {
      container.listen(
        territoryEditorControllerProvider(creatingTarget),
        (previous, next) {},
      );
      final controller = container.read(
        territoryEditorControllerProvider(creatingTarget).notifier,
      );
      await Future.doWhile(() async {
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return container
            .read(territoryEditorControllerProvider(creatingTarget))
            .loading;
      });
      return controller;
    }

    test(
      'starts with an empty, invalid boundary and no original territory',
      () async {
        await loadCreatingController();
        final state = container.read(
          territoryEditorControllerProvider(creatingTarget),
        );

        expect(state.isCreating, isTrue);
        expect(state.original, isNull);
        expect(state.working, isEmpty);
        expect(state.validation.isValid, isFalse);
        expect(state.canSave, isFalse);
      },
    );

    test('the first Add-area draw becomes the territory outright — no '
        '"must touch the boundary" rejection since there is nothing to '
        'touch yet', () async {
      final controller = await loadCreatingController();
      await controller.setDraft(
        const TerritoryDraft(
          name: 'Zona Teste',
          kind: TerritoryKind.managerZone,
          verticalId: 'vertical-oncologia',
        ),
      );

      var state = container.read(
        territoryEditorControllerProvider(creatingTarget),
      );
      expect(state.mode, EditorMode.addArea);

      expect(controller.addDrawingPoint(_c(20, 20)), isTrue);
      expect(controller.addDrawingPoint(_c(22, 20)), isTrue);
      expect(controller.addDrawingPoint(_c(22, 22)), isTrue);
      expect(controller.addDrawingPoint(_c(20, 22)), isTrue);
      expect(controller.finishDrawing(), isTrue);

      state = container.read(territoryEditorControllerProvider(creatingTarget));
      expect(state.working!.length, 1);
      expect(state.validation.isValid, isTrue);
      expect(state.isDirty, isTrue);
      expect(state.canSave, isTrue);
    });

    test('setDraft re-fetches neighbors for the chosen kind/sector', () async {
      final controller = await loadCreatingController();
      expect(
        container
            .read(territoryEditorControllerProvider(creatingTarget))
            .neighbors,
        isEmpty,
      );

      await controller.setDraft(
        const TerritoryDraft(
          name: 'Zona Teste',
          kind: TerritoryKind.managerZone,
          verticalId: 'vertical-oncologia',
        ),
      );

      final state = container.read(
        territoryEditorControllerProvider(creatingTarget),
      );
      expect(
        state.neighbors.map((t) => t.id),
        containsAll(['target', 'neighbor']),
      );
    });

    test('save() creates a new territory instead of updating one', () async {
      final controller = await loadCreatingController();
      await controller.setDraft(
        const TerritoryDraft(
          name: 'Zona Teste',
          kind: TerritoryKind.managerZone,
          verticalId: 'vertical-oncologia',
        ),
      );
      controller.addDrawingPoint(_c(20, 20));
      controller.addDrawingPoint(_c(22, 20));
      controller.addDrawingPoint(_c(22, 22));
      controller.addDrawingPoint(_c(20, 22));
      controller.finishDrawing();

      final saved = await controller.save();
      expect(saved, isTrue);
      expect(repository.lastCreatedDraft?.name, 'Zona Teste');
      expect(repository.lastSavedId, isNull);

      final state = container.read(
        territoryEditorControllerProvider(creatingTarget),
      );
      expect(state.saved, isTrue);
      expect(state.original, isNotNull);
    });
  });
}
